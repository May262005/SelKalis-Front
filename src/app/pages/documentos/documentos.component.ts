import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { SafeUrlPipe } from './safe-url.pipe';
import { DocumentosService, Documento } from '../../services/documentos.service';
import { SearchService } from '../../services/search.service';

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeUrlPipe],
  templateUrl: './documentos.component.html',
  styleUrls: ['./documentos.component.css']
})
export class DocumentosComponent implements OnInit, OnDestroy {
  documentos: Documento[] = [];
  documentosFiltrados: Documento[] = [];
  terminoBusqueda: string = '';
  filtroActual: string = 'todos';
  mostrarModal: boolean = false;
  isLoading: boolean = false;
  isLoadingBusqueda: boolean = false;
  isLoadingSubida: boolean = false;
  errorMessage: string = '';
  
  private loadingTimeout: any = null;
  
  // ✅ Resultados de Elasticsearch (cache separado, nunca pisa this.documentos)
  documentosResultados: Documento[] = [];
  
  private searchSubject = new Subject<string>();
  private readonly MIN_SEARCH_CHARS = 1;
  
  // Vista previa
  mostrarVistaPrevia: boolean = false;
  documentoActual: Documento | null = null;
  
  // Para la camara
  stream: MediaStream | null = null;
  @ViewChild('cameraVideo') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  camaraActiva: boolean = false;
  
  // Archivo a subir
  archivoSeleccionado: File | null = null;
  previewUrl: string | null = null;
  
  nuevoDocumento = {
    nombre: '',
    categoria: 'otro' as 'receta' | 'estudio' | 'informe' | 'otro',
    descripcion: ''
  };

  private readonly COLORS = {
    receta: '#4A6FA5',
    estudio: '#6FA8DC',
    informe: '#8FB5E5',
    otro: '#7B8CA8'
  };

  constructor(
    private documentosService: DocumentosService,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.cargarDocumentos();

    // ==================== Búsqueda con Elasticsearch ====================
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((termino) => {
        if (termino.trim().length < this.MIN_SEARCH_CHARS) {
          this.isLoadingBusqueda = false;
          this.documentosResultados = [];
          this.filtrarDocumentos();
          return [];
        }
        this.isLoadingBusqueda = true;
        return this.searchService.buscarModulo('documentos', termino, this.getFiltrosElasticsearch());
      })
    ).subscribe({
      next: (response: any) => {
        this.isLoadingBusqueda = false;
        if (response && response.success && response.data?.resultados?.length > 0) {
          this.documentosResultados = response.data.resultados.map((r: any) => ({
            id: r.id,
            nombre: r.datos?.nombre || r.titulo || '',
            categoria: r.datos?.categoria || 'otro',
            descripcion: r.datos?.descripcion || '',
            tipo: r.datos?.tipo || '',
            url: r.datos?.url || '',
            tamano: r.datos?.tamano || '',
            created_at: r.datos?.created_at || r.fecha || '',
            fecha: r.datos?.fecha || ''
          }));
        } else {
          this.documentosResultados = [];
        }
        this.filtrarDocumentos();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingBusqueda = false;
        this.documentosResultados = [];
        this.filtrarDocumentos();
      }
    });
  }

  ngOnDestroy() {
    this.clearLoadingTimeout();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }

  // ==================== BÚSQUEDA CON ELASTICSEARCH ====================
  private getFiltrosElasticsearch(): any {
    const filtros: any = {};
    if (this.filtroActual !== 'todos') {
      filtros.categoria = this.filtroActual;
    }
    return filtros;
  }

  // ==================== INDEXAR EN ELASTICSEARCH ====================
  private indexarDocumentosEnElasticsearch(documentos: Documento[]) {
    for (const documento of documentos) {
      if (documento.id) {
        const doc = {
          id: documento.id,
          nombre: documento.nombre.replace(/\./g, ' '),
          categoria: documento.categoria,
          descripcion: documento.descripcion || '',
          tipo: documento.tipo || '',
          url: documento.url || '',
          tamano: documento.tamano || '',
          created_at: documento.created_at || '',
          fecha: documento.fecha || ''
        };
        this.searchService.indexar('documentos', doc).subscribe();
      }
    }
  }

  private indexarDocumento(documento: Documento) {
    if (documento.id) {
      const doc = {
        id: documento.id,
        nombre: documento.nombre.replace(/\./g, ' '),
        categoria: documento.categoria,
        descripcion: documento.descripcion || '',
        tipo: documento.tipo || '',
        url: documento.url || '',
        tamano: documento.tamano || '',
        created_at: documento.created_at || '',
        fecha: documento.fecha || ''
      };
      this.searchService.indexar('documentos', doc).subscribe();
    }
  }

  // ==================== MÉTODOS EXISTENTES ====================

  private clearLoadingTimeout() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  private setLoading(value: boolean) {
    this.clearLoadingTimeout();
    this.isLoading = value;
    this.cdr.detectChanges();

    if (value) {
      this.loadingTimeout = setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.showToast('La solicitud tardo demasiado. Intenta de nuevo.', 'warning');
      }, 15000);
    }
  }

  cargarDocumentos() {
    this.setLoading(true);
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.documentosService.getDocumentos(this.filtroActual === 'todos' ? undefined : this.filtroActual).subscribe({
      next: (response: any) => {
        this.clearLoadingTimeout();
        this.isLoading = false;
        if (response.success && response.data) {
          this.documentos = response.data;
          this.indexarDocumentosEnElasticsearch(response.data);
          this.filtrarDocumentos();
          this.cdr.detectChanges();
          setTimeout(() => this.cdr.detectChanges(), 50);
        } else {
          this.documentos = [];
          this.filtrarDocumentos();
          this.cdr.detectChanges();
        }
      },
      error: (error: any) => {
        this.clearLoadingTimeout();
        this.isLoading = false;
        this.errorMessage = error?.userMessage || 'Error al cargar los documentos';
        this.documentos = [];
        this.filtrarDocumentos();
        this.cdr.detectChanges();
        this.showToast(this.errorMessage, 'error');
      }
    });
  }

  // ✅ METODO PRINCIPAL DE FILTRADO - igual que en tratamientos
  filtrarDocumentos() {
    const usarBusquedaES = this.terminoBusqueda.trim().length >= this.MIN_SEARCH_CHARS
      && this.documentosResultados.length > 0;

    let filtrados = usarBusquedaES ? [...this.documentosResultados] : [...this.documentos];

    if (this.filtroActual !== 'todos') {
      filtrados = filtrados.filter(d => d.categoria === this.filtroActual);
    }

    // Si venimos de Elasticsearch, el término ya se aplicó en el backend
    if (!usarBusquedaES && this.terminoBusqueda.trim()) {
      const term = this.terminoBusqueda.toLowerCase();
      filtrados = filtrados.filter(d =>
        d.nombre.toLowerCase().includes(term) ||
        (d.descripcion && d.descripcion.toLowerCase().includes(term))
      );
    }

    this.documentosFiltrados = filtrados;
    this.cdr.detectChanges();
  }

  onSearchChange(termino: string) {
    this.terminoBusqueda = termino;
    this.searchSubject.next(termino);
  }

  cambiarFiltro(filtro: string) {
    this.filtroActual = filtro;
    // ✅ Si hay búsqueda, re-ejecutar búsqueda con el nuevo filtro
    if (this.terminoBusqueda.trim().length >= this.MIN_SEARCH_CHARS) {
      this.searchSubject.next(this.terminoBusqueda);
    } else {
      // ✅ Si no hay búsqueda, recargar documentos con el filtro
      this.cargarDocumentos();
    }
  }

  abrirModal() {
    this.mostrarModal = true;
    this.errorMessage = '';
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.resetFormulario();
  }

  cerrarModal() {
    this.mostrarModal = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.detenerCamara();
    this.resetFormulario();
  }

  resetFormulario() {
    this.archivoSeleccionado = null;
    this.previewUrl = null;
    this.nuevoDocumento = {
      nombre: '',
      categoria: 'otro',
      descripcion: ''
    };
    this.detenerCamara();
    this.errorMessage = '';
    this.isLoadingSubida = false;
  }

  abrirVistaPrevia(doc: Documento) {
    this.documentoActual = doc;
    this.mostrarVistaPrevia = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
  }

  cerrarVistaPrevia() {
    this.mostrarVistaPrevia = false;
    this.documentoActual = null;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.archivoSeleccionado = input.files[0];
      this.nuevoDocumento.nombre = this.archivoSeleccionado.name.replace(/\.[^.]+$/, '');
      
      if (this.archivoSeleccionado.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.previewUrl = e.target?.result as string;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(this.archivoSeleccionado);
      } else if (this.archivoSeleccionado.type === 'application/pdf') {
        this.previewUrl = URL.createObjectURL(this.archivoSeleccionado);
      }
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.archivoSeleccionado = event.dataTransfer.files[0];
      this.nuevoDocumento.nombre = this.archivoSeleccionado.name.replace(/\.[^.]+$/, '');
      
      if (this.archivoSeleccionado.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.previewUrl = e.target?.result as string;
          this.cdr.detectChanges();
        };
        reader.readAsDataURL(this.archivoSeleccionado);
      } else if (this.archivoSeleccionado.type === 'application/pdf') {
        this.previewUrl = URL.createObjectURL(this.archivoSeleccionado);
      }
    }
  }

  async iniciarCamara() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.camaraActiva = true;
    this.cdr.detectChanges();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      this.stream = stream;
      
      if (this.videoRef) {
        this.videoRef.nativeElement.srcObject = stream;
        await this.videoRef.nativeElement.play();
      }
    } catch (err) {
      this.showToast('No se pudo acceder a la camara', 'error');
      this.camaraActiva = false;
      this.cdr.detectChanges();
    }
  }

  detenerCamara() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.camaraActiva = false;
    if (this.videoRef) {
      this.videoRef.nativeElement.srcObject = null;
    }
  }

  tomarFoto() {
    if (this.videoRef && this.canvasRef) {
      const video = this.videoRef.nativeElement;
      const canvas = this.canvasRef.nativeElement;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `foto_${Date.now()}.png`, { type: 'image/png' });
            this.archivoSeleccionado = file;
            this.nuevoDocumento.nombre = 'foto_' + new Date().toISOString().slice(0, 10);
            this.previewUrl = URL.createObjectURL(file);
            this.detenerCamara();
            this.cdr.detectChanges();
            this.showToast('Foto tomada correctamente', 'success');
          }
        }, 'image/png');
      }
    }
  }

  guardarDocumento() {
    if (!this.archivoSeleccionado) {
      this.errorMessage = 'Selecciona un archivo o toma una foto';
      this.showToast(this.errorMessage, 'error');
      return;
    }
    
    if (!this.nuevoDocumento.nombre || this.nuevoDocumento.nombre.trim() === '') {
      this.errorMessage = 'Ingresa un nombre para el documento';
      this.showToast(this.errorMessage, 'error');
      return;
    }
    
    this.isLoadingSubida = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const subidaTimeout = setTimeout(() => {
      this.isLoadingSubida = false;
      this.cdr.detectChanges();
      this.showToast('La subida esta tardando mas de lo esperado. Verifica tu conexion.', 'warning');
    }, 30000);

    this.documentosService.subirDocumento(
      this.archivoSeleccionado,
      this.nuevoDocumento.nombre.trim(),
      this.nuevoDocumento.categoria,
      this.nuevoDocumento.descripcion
    ).subscribe({
      next: (response: any) => {
        clearTimeout(subidaTimeout);
        this.isLoadingSubida = false;
        if (response.success) {
          this.cargarDocumentos();
          this.cerrarModal();
          this.showToast('Documento subido correctamente', 'success');
          if (response.data) {
            this.indexarDocumento(response.data);
          }
        } else {
          this.errorMessage = response.error || 'Error al subir el documento';
          this.showToast(this.errorMessage, 'error');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        clearTimeout(subidaTimeout);
        this.isLoadingSubida = false;
        this.errorMessage = error?.userMessage || 'Error al subir el documento';
        this.showToast(this.errorMessage, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  descargarDocumento(doc: Documento) {
    this.showToast('Descargando: ' + doc.nombre, 'info');
    
    this.documentosService.descargarDocumento(doc.id).subscribe({
      next: (blob: Blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = doc.nombre;
        link.click();
        URL.revokeObjectURL(link.href);
        this.showToast('Descargado: ' + doc.nombre, 'success');
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        const url = this.documentosService.getUrlDescarga(doc.id);
        window.open(url, '_blank');
        this.showToast('Abriendo: ' + doc.nombre, 'info');
        this.cdr.detectChanges();
      }
    });
  }

  eliminarDocumento(id: string) {
    if (confirm('Eliminar este documento?')) {
      this.setLoading(true);

      this.documentosService.eliminarDocumento(id).subscribe({
        next: (response: any) => {
          this.clearLoadingTimeout();
          this.isLoading = false;
          if (response.success) {
            this.cargarDocumentos();
            this.showToast('Documento eliminado', 'info');
          }
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          this.clearLoadingTimeout();
          this.isLoading = false;
          this.showToast(error?.userMessage || 'Error al eliminar el documento', 'error');
          this.cdr.detectChanges();
        }
      });
    }
  }

  getIconoPorTipo(tipo: string, categoria: string): string {
    if (categoria === 'receta') return 'fas fa-prescription-bottle';
    if (categoria === 'estudio') return 'fas fa-microscope';
    if (categoria === 'informe') return 'fas fa-file-alt';
    if (tipo === 'application/pdf') return 'fas fa-file-pdf';
    if (tipo?.startsWith('image/')) return 'fas fa-file-image';
    return 'fas fa-file';
  }

  getColorPorTipo(categoria: string): string {
    switch(categoria) {
      case 'receta': return this.COLORS.receta;
      case 'estudio': return this.COLORS.estudio;
      case 'informe': return this.COLORS.informe;
      default: return this.COLORS.otro;
    }
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const existingToast = document.getElementById('selkalis-toast');
    if (existingToast) existingToast.remove();

    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.id = 'selkalis-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      padding: 18px 32px;
      background: #E8F0FE;
      border-radius: 14px;
      box-shadow: 0 6px 24px rgba(31, 58, 95, 0.18);
      border: 1px solid #B8D4F0;
      font-family: 'Segoe UI', system-ui, sans-serif;
      z-index: 9999;
      max-width: 90vw;
      min-width: 320px;
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
    `;

    const icon = document.createElement('i');
    icon.className = `fas ${iconMap[type]}`;
    icon.style.cssText = `
      font-size: 28px;
      color: #4A6FA5;
      flex-shrink: 0;
      width: 32px;
      text-align: center;
    `;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    textSpan.style.cssText = `
      font-size: 16px;
      font-weight: 500;
      color: #1F3A5F;
      line-height: 1.5;
      word-break: break-word;
    `;

    container.appendChild(icon);
    container.appendChild(textSpan);
    toast.appendChild(container);
    document.body.appendChild(toast);
    toast.offsetHeight;

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-100px)';
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 400);
    }, 4000);
  }

  recargar() {
    this.cargarDocumentos();
    this.showToast('Documentos actualizados', 'info');
  }
}