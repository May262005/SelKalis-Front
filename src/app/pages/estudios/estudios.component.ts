import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { EstudiosService, Estudio } from '../../services/estudios.service';
import { SearchService } from '../../services/search.service';

@Component({
  selector: 'app-estudios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estudios.component.html',
  styleUrls: ['./estudios.component.css']
})
export class EstudiosComponent implements OnInit {
  estudiosOriginales: Estudio[] = [];
  estudios: Estudio[] = [];
  estudiosFiltrados: Estudio[] = [];
  terminoBusqueda: string = '';
  filtroActual: string = 'todos';
  isLoading: boolean = false;
  isLoadingBusqueda: boolean = false;
  errorMessage: string = '';
  errorGuardando: string = '';
  hoy: Date = new Date();
  fechaMinima: string = '';

  mostrarModal: boolean = false;
  mostrarModalDetalle: boolean = false;
  estudioSeleccionado: Estudio | null = null;
  editandoId: string | null = null;
  esReagendar: boolean = false;
  esEdicion: boolean = false;

  estudioExpandidoId: string | null = null;

  itemsPorPagina: number = 10;
  paginaActual: number = 1;
  Math = Math;

  vistaActual: 'lista' | 'mes' | 'semana' | 'dia' = 'lista';
  mesActual: number = new Date().getMonth() + 1;
  anioActual: number = new Date().getFullYear();
  fechaSeleccionada: Date = new Date();

  semanaActual: Date[] = [];
  estudiosPorHora: { hora: string; estudios: Estudio[] }[] = [];
  diasDelMes: { fecha: Date; dia: number; estudios: Estudio[] }[] = [];

  private searchSubject = new Subject<string>();
  private readonly MIN_SEARCH_CHARS = 1;

  nuevoEstudio = {
    titulo: '',
    tipo: '',
    fecha: '',
    hora: '',
    lugar: '',
    notas: ''
  };

  mostrarModalConfirmacion: boolean = false;
  confirmacion = {
    titulo: '',
    mensaje: '',
    textoConfirmar: 'Confirmar',
    textoCancelar: 'Cancelar',
    accionConfirmar: () => {}
  };

  tiposEstudio: string[] = [
    'Laboratorio',
    'Radiologia',
    'Tomografia',
    'Resonancia',
    'Ultrasonido',
    'Electrocardiograma',
    'Endoscopia',
    'Biopsia',
    'Otro'
  ];

  constructor(
    private estudiosService: EstudiosService,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.fechaMinima = this.formatearFechaLocal(new Date());
    this.nuevoEstudio.fecha = this.formatearFechaLocal(new Date());
    this.nuevoEstudio.hora = this.obtenerHoraActual();
    this.generarSemanaActual();
    this.generarHorasDelDia();
    this.generarCalendarioMes();

    if (isPlatformBrowser(this.platformId)) {
      this.cargarEstudios();
    }

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((termino) => {
        if (termino.trim().length < this.MIN_SEARCH_CHARS) {
          this.isLoadingBusqueda = false;
          this.estudios = [...this.estudiosOriginales];
          this.aplicarFiltrosLocales();
          this.actualizarVista();
          this.cdr.detectChanges();
          return [];
        }
        this.isLoadingBusqueda = true;
        // ✅ Siempre pasar el filtro actual a Elasticsearch
        return this.searchService.buscarModulo('estudios', termino, this.getFiltrosElasticsearch());
      })
    ).subscribe({
      next: (response: any) => {
        this.isLoadingBusqueda = false;
        if (response && response.success) {
          const resultadosRaw = response.data?.resultados || [];
          
          if (resultadosRaw.length === 0) {
            this.estudios = [];
            this.aplicarFiltrosLocales();
            this.actualizarVista();
            this.cdr.detectChanges();
            return;
          }
          
          const resultados = resultadosRaw.map((r: any) => ({
            id: r.id,
            titulo: r.datos?.titulo || r.titulo || '',
            tipo: r.datos?.tipo || r.tipo || '',
            fecha: r.datos?.fecha || r.fecha || '',
            hora: r.datos?.hora || r.hora || '',
            lugar: r.datos?.lugar || r.lugar || '',
            notas: r.datos?.notas || r.notas || '',
            estado: r.datos?.estado || r.estado || 'pendiente'
          }));
          
          this.estudios = resultados;
          // ✅ SIEMPRE aplicar filtros locales después de la búsqueda
          this.aplicarFiltrosLocales();
          this.actualizarVista();
          this.cdr.detectChanges();
        } else {
          this.estudios = [...this.estudiosOriginales];
          this.aplicarFiltrosLocales();
          this.actualizarVista();
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.isLoadingBusqueda = false;
        this.estudios = [...this.estudiosOriginales];
        this.aplicarFiltrosLocales();
        this.actualizarVista();
        this.cdr.detectChanges();
      }
    });
  }

  private getFiltrosElasticsearch(): any {
    const filtros: any = {};
    if (this.filtroActual === 'pendientes') {
      filtros.estado = 'pendiente';
    } else if (this.filtroActual === 'completados') {
      filtros.estado = 'completado';
    } else if (this.filtroActual === 'cancelados') {
      filtros.estado = 'cancelado';
    }
    return filtros;
  }

  private aplicarFiltrosLocales() {
    let filtrados = [...this.estudios];

    if (this.filtroActual === 'pendientes') {
      filtrados = filtrados.filter(e => e.estado === 'pendiente');
    } else if (this.filtroActual === 'completados') {
      filtrados = filtrados.filter(e => e.estado === 'completado');
    } else if (this.filtroActual === 'cancelados') {
      filtrados = filtrados.filter(e => e.estado === 'cancelado');
    }

    filtrados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    this.estudiosFiltrados = filtrados;
    this.paginaActual = 1;
    this.cdr.detectChanges();
  }

  private indexarEstudiosEnElasticsearch(estudios: Estudio[]) {
    for (const estudio of estudios) {
      if (estudio.id) {
        const documento = {
          id: estudio.id,
          titulo: estudio.titulo.replace(/\./g, ' '),
          tipo: estudio.tipo,
          fecha: estudio.fecha,
          hora: estudio.hora,
          lugar: estudio.lugar || '',
          notas: estudio.notas || '',
          estado: estudio.estado
        };
        this.searchService.indexar('estudios', documento).subscribe();
      }
    }
  }

  private indexarEstudio(estudio: Estudio) {
    if (estudio.id) {
      const documento = {
        id: estudio.id,
        titulo: estudio.titulo.replace(/\./g, ' '),
        tipo: estudio.tipo,
        fecha: estudio.fecha,
        hora: estudio.hora,
        lugar: estudio.lugar || '',
        notas: estudio.notas || '',
        estado: estudio.estado
      };
      this.searchService.indexar('estudios', documento).subscribe();
    }
  }

  get totalPaginas(): number {
    return Math.ceil(this.estudiosFiltrados.length / this.itemsPorPagina);
  }

  get estudiosPaginados(): Estudio[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.estudiosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  obtenerPaginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.paginaActual;
    const paginas: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        paginas.push(i);
      }
    } else {
      paginas.push(1);
      if (actual > 3) {
        paginas.push(-1);
      }
      const inicio = Math.max(2, actual - 1);
      const fin = Math.min(total - 1, actual + 1);
      for (let i = inicio; i <= fin; i++) {
        if (!paginas.includes(i) && i !== 1 && i !== total) {
          paginas.push(i);
        }
      }
      if (actual < total - 2) {
        paginas.push(-1);
      }
      if (total > 1 && !paginas.includes(total)) {
        paginas.push(total);
      }
    }
    return paginas;
  }

  cambiarPagina(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
      this.cdr.detectChanges();
    }
  }

  toggleEstudio(id: string) {
    this.estudioExpandidoId = this.estudioExpandidoId === id ? null : id;
  }

  onSearchChange(termino: string) {
    this.terminoBusqueda = termino;
    this.searchSubject.next(termino);
  }

  cambiarVista(vista: 'lista' | 'mes' | 'semana' | 'dia') {
    this.vistaActual = vista;
    this.actualizarVista();
  }

  actualizarVista() {
    if (this.vistaActual === 'mes') {
      this.generarCalendarioMes();
    } else if (this.vistaActual === 'semana') {
      this.generarSemanaActual();
    } else if (this.vistaActual === 'dia') {
      this.generarHorasDelDia();
    }
  }

  generarCalendarioMes() {
    this.diasDelMes = [];
    const primerDia = new Date(this.anioActual, this.mesActual - 1, 1);
    const ultimoDia = new Date(this.anioActual, this.mesActual, 0);

    const diaInicio = primerDia.getDay();
    const offset = (diaInicio === 0) ? 6 : diaInicio - 1;

    for (let i = 0; i < offset; i++) {
      const fechaVacia = new Date(this.anioActual, this.mesActual - 1, 1 - offset + i);
      this.diasDelMes.push({
        fecha: fechaVacia,
        dia: fechaVacia.getDate(),
        estudios: []
      });
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha = new Date(this.anioActual, this.mesActual - 1, dia);
      const fechaStr = this.formatearFechaLocal(fecha);
      const estudiosDelDia = this.estudiosFiltrados.filter(e => e.fecha === fechaStr);

      this.diasDelMes.push({
        fecha,
        dia,
        estudios: estudiosDelDia
      });
    }
  }

  mesAnterior() {
    this.mesActual--;
    if (this.mesActual < 1) {
      this.mesActual = 12;
      this.anioActual--;
    }
    this.generarCalendarioMes();
  }

  mesSiguiente() {
    this.mesActual++;
    if (this.mesActual > 12) {
      this.mesActual = 1;
      this.anioActual++;
    }
    this.generarCalendarioMes();
  }

  irHoy() {
    const hoy = new Date();
    this.mesActual = hoy.getMonth() + 1;
    this.anioActual = hoy.getFullYear();
    this.fechaSeleccionada = hoy;
    this.generarCalendarioMes();
  }

  esHoy(fecha: Date): boolean {
    const hoy = new Date();
    return fecha.getDate() === hoy.getDate() &&
           fecha.getMonth() === hoy.getMonth() &&
           fecha.getFullYear() === hoy.getFullYear();
  }

  generarSemanaActual() {
    this.semanaActual = [];
    const fecha = new Date(this.fechaSeleccionada);
    const diaSemana = fecha.getDay();
    const diff = fecha.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);

    for (let i = 0; i < 7; i++) {
      const dia = new Date(fecha);
      dia.setDate(diff + i);
      this.semanaActual.push(dia);
    }
  }

  semanaAnterior() {
    const fecha = new Date(this.fechaSeleccionada);
    fecha.setDate(fecha.getDate() - 7);
    this.fechaSeleccionada = fecha;
    this.generarSemanaActual();
  }

  semanaSiguiente() {
    const fecha = new Date(this.fechaSeleccionada);
    fecha.setDate(fecha.getDate() + 7);
    this.fechaSeleccionada = fecha;
    this.generarSemanaActual();
  }

  getEstudiosDelDia(fecha: Date): Estudio[] {
    const fechaStr = this.formatearFechaLocal(fecha);
    return this.estudiosFiltrados.filter(e => e.fecha === fechaStr);
  }

  generarHorasDelDia() {
    this.estudiosPorHora = [];
    const fechaStr = this.formatearFechaLocal(this.fechaSeleccionada);
    const estudiosDelDia = this.estudiosFiltrados.filter(e => e.fecha === fechaStr);

    for (let h = 6; h <= 22; h++) {
      const horaStr = `${h.toString().padStart(2, '0')}:00`;
      const estudiosEnHora = estudiosDelDia.filter(e => e.hora.startsWith(horaStr.substring(0, 2)));

      this.estudiosPorHora.push({
        hora: horaStr,
        estudios: estudiosEnHora
      });
    }
  }

  diaAnterior() {
    const fecha = new Date(this.fechaSeleccionada);
    fecha.setDate(fecha.getDate() - 1);
    this.fechaSeleccionada = fecha;
    this.generarHorasDelDia();
  }

  diaSiguiente() {
    const fecha = new Date(this.fechaSeleccionada);
    fecha.setDate(fecha.getDate() + 1);
    this.fechaSeleccionada = fecha;
    this.generarHorasDelDia();
  }

  irHoyDia() {
    this.fechaSeleccionada = new Date();
    this.generarHorasDelDia();
  }

  seleccionarFecha(fecha: Date) {
    this.fechaSeleccionada = fecha;
    if (this.vistaActual === 'dia') {
      this.generarHorasDelDia();
    }
  }

  isFechaSeleccionada(fecha: Date): boolean {
    if (!this.fechaSeleccionada) return false;
    return fecha.getDate() === this.fechaSeleccionada.getDate() &&
           fecha.getMonth() === this.fechaSeleccionada.getMonth() &&
           fecha.getFullYear() === this.fechaSeleccionada.getFullYear();
  }

  obtenerNombreDia(fecha: Date): string {
    const dias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    return dias[fecha.getDay()];
  }

  obtenerNombreMes(mes: number): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[mes - 1];
  }

  formatearFechaLocal(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const d = fecha.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private obtenerHoraActual(): string {
    const ahora = new Date();
    return `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;
  }

  formatearHora12(hora24: string): string {
    if (!hora24) return '';
    const partes = hora24.split(':');
    let h = parseInt(partes[0], 10);
    const m = (partes[1] || '00').padStart(2, '0');
    if (isNaN(h)) return hora24;
    const sufijo = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${sufijo}`;
  }

  formatearHora(hora24: string): string {
    return this.formatearHora12(hora24);
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const opciones: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };
    const fechaObj = new Date(fecha + 'T00:00:00');
    return fechaObj.toLocaleDateString('es-ES', opciones);
  }

  obtenerFechaMinima(): string {
    return this.formatearFechaLocal(new Date());
  }

  private esFechaPasada(fecha: string): boolean {
    return fecha < this.obtenerFechaMinima();
  }

  obtenerMensajeError(error: any): string {
    return error?.error?.error || error?.message || 'Error desconocido';
  }

  cargarEstudios() {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.estudiosService.getEstudios().subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.success && response.data) {
          this.estudiosOriginales = response.data;
          this.estudios = response.data;
          this.marcarEstudiosVencidosComoCompletados();
          this.indexarEstudiosEnElasticsearch(response.data);
          this.aplicarFiltros();
          this.actualizarVista();
          this.cdr.detectChanges();
          setTimeout(() => this.cdr.detectChanges(), 50);
        } else {
          this.estudiosOriginales = [];
          this.estudios = [];
          this.aplicarFiltros();
          this.actualizarVista();
          this.cdr.detectChanges();
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = this.obtenerMensajeError(error);
        this.estudiosOriginales = [];
        this.estudios = [];
        this.aplicarFiltros();
        this.actualizarVista();
        this.cdr.detectChanges();
        this.showToast('Error al cargar los estudios', 'error');
      }
    });
  }

  private marcarEstudiosVencidosComoCompletados() {
    const hoy = this.formatearFechaLocal(new Date());
    const vencidos = this.estudios.filter(e => e.estado === 'pendiente' && e.fecha < hoy && e.id);

    if (vencidos.length === 0) {
      this.aplicarFiltros();
      this.actualizarVista();
      this.cdr.detectChanges();
      return;
    }

    const cambios = vencidos.map(e => this.estudiosService.cambiarEstado(e.id!, 'completado'));
    forkJoin(cambios).subscribe({
      next: () => {
        vencidos.forEach(v => { v.estado = 'completado'; });
        this.indexarEstudiosEnElasticsearch(vencidos);
        this.aplicarFiltros();
        this.actualizarVista();
        this.cdr.detectChanges();
      },
      error: () => {
        this.aplicarFiltros();
        this.actualizarVista();
        this.cdr.detectChanges();
      }
    });
  }

  aplicarFiltros() {
    // ✅ Si hay búsqueda, usar Elasticsearch (con el filtro actual)
    if (this.terminoBusqueda.trim().length >= this.MIN_SEARCH_CHARS) {
      this.searchSubject.next(this.terminoBusqueda);
      return;
    }
    // ✅ Si no hay búsqueda, restaurar todos los estudios y aplicar filtros locales
    this.estudios = [...this.estudiosOriginales];
    this.aplicarFiltrosLocales();
    this.actualizarVista();
    this.cdr.detectChanges();
  }

  cambiarFiltro(filtro: string) {
    this.filtroActual = filtro;
    this.paginaActual = 1;
    // ✅ SIEMPRE aplicar filtros, incluso si hay búsqueda activa
    if (this.terminoBusqueda.trim().length >= this.MIN_SEARCH_CHARS) {
      // Si hay búsqueda, re-ejecutar la búsqueda con el nuevo filtro
      this.searchSubject.next(this.terminoBusqueda);
    } else {
      // Si no hay búsqueda, aplicar filtros locales
      this.estudios = [...this.estudiosOriginales];
      this.aplicarFiltrosLocales();
      this.actualizarVista();
      this.cdr.detectChanges();
    }
  }

  verDetalleEstudio(estudio: Estudio) {
    this.estudioSeleccionado = estudio;
    this.mostrarModalDetalle = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModalDetalle() {
    this.mostrarModalDetalle = false;
    this.estudioSeleccionado = null;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.cdr.detectChanges();
  }

  abrirModal(estudio?: Estudio) {
    this.errorGuardando = '';
    this.esReagendar = false;
    this.esEdicion = false;
    
    if (estudio) {
      const hoy = this.formatearFechaLocal(new Date());
      if (estudio.fecha < hoy) {
        this.showToast('No se puede editar un estudio con fecha pasada', 'warning');
        return;
      }
      this.esEdicion = true;
      this.editandoId = estudio.id || null;
      this.nuevoEstudio = {
        titulo: estudio.titulo,
        tipo: estudio.tipo,
        fecha: estudio.fecha,
        hora: estudio.hora,
        lugar: estudio.lugar || '',
        notas: estudio.notas || ''
      };
    } else {
      this.editandoId = null;
      this.resetFormulario();
    }
    this.mostrarModal = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  reagendarEstudioDesdeDetalle(estudio: Estudio) {
    this.cerrarModalDetalle();
    this.esReagendar = true;
    this.esEdicion = false;
    this.editandoId = estudio.id || null;
    this.nuevoEstudio = {
      titulo: estudio.titulo,
      tipo: estudio.tipo,
      fecha: estudio.fecha,
      hora: estudio.hora,
      lugar: estudio.lugar || '',
      notas: estudio.notas || ''
    };
    this.mostrarModal = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.errorGuardando = '';
    this.esReagendar = false;
    this.esEdicion = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.editandoId = null;
    this.resetFormulario();
    this.cdr.detectChanges();
  }

  resetFormulario() {
    const hoy = new Date();
    this.nuevoEstudio = {
      titulo: '',
      tipo: '',
      fecha: this.formatearFechaLocal(hoy),
      hora: this.obtenerHoraActual(),
      lugar: '',
      notas: ''
    };
  }

  guardarEstudio() {
    this.errorGuardando = '';

    if (!this.nuevoEstudio.titulo) {
      this.errorGuardando = 'El titulo es obligatorio';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (!this.nuevoEstudio.tipo) {
      this.errorGuardando = 'El tipo de estudio es obligatorio';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (!this.nuevoEstudio.fecha) {
      this.errorGuardando = 'La fecha es obligatoria';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (!this.nuevoEstudio.hora) {
      this.errorGuardando = 'La hora es obligatoria';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (this.esEdicion && !this.esReagendar) {
      const data = {
        titulo: this.nuevoEstudio.titulo,
        tipo: this.nuevoEstudio.tipo,
        lugar: this.nuevoEstudio.lugar || '',
        notas: this.nuevoEstudio.notas || ''
      };

      this.isLoading = true;
      this.errorGuardando = '';
      this.cdr.detectChanges();

      this.estudiosService.updateEstudio(this.editandoId!, data).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.success) {
            this.cargarEstudios();
            this.cerrarModal();
            this.showToast('Estudio actualizado correctamente', 'success');
          } else {
            this.errorGuardando = response.error || 'Error al guardar';
            this.showToast(this.errorGuardando, 'error');
          }
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorGuardando = this.obtenerMensajeError(error);
          this.showToast('Error al guardar: ' + this.errorGuardando, 'error');
          this.cdr.detectChanges();
        }
      });
      return;
    }

    if (!this.esEdicion && this.esFechaPasada(this.nuevoEstudio.fecha)) {
      this.errorGuardando = 'La fecha no puede ser un dia que ya paso';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    const data = {
      titulo: this.nuevoEstudio.titulo,
      tipo: this.nuevoEstudio.tipo,
      fecha: this.nuevoEstudio.fecha,
      hora: this.nuevoEstudio.hora,
      lugar: this.nuevoEstudio.lugar || '',
      notas: this.nuevoEstudio.notas || ''
    };

    this.isLoading = true;
    this.errorGuardando = '';
    this.cdr.detectChanges();

    const operation = this.editandoId
      ? this.estudiosService.updateEstudio(this.editandoId, data)
      : this.estudiosService.createEstudio(data);

    operation.subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.success) {
          this.cargarEstudios();
          this.cerrarModal();
          const mensaje = this.esReagendar ? 'Estudio reagendado correctamente' :
                          this.editandoId ? 'Estudio actualizado correctamente' :
                          'Estudio registrado correctamente';
          this.showToast(mensaje, 'success');
          if (response.data) {
            this.indexarEstudio(response.data);
          }
        } else {
          this.errorGuardando = response.error || 'Error al guardar';
          this.showToast(this.errorGuardando, 'error');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorGuardando = this.obtenerMensajeError(error);
        this.showToast('Error al guardar: ' + this.errorGuardando, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  private abrirConfirmacion(
    titulo: string,
    mensaje: string,
    accionConfirmar: () => void,
    opciones?: { textoConfirmar?: string; textoCancelar?: string }
  ) {
    this.confirmacion = {
      titulo,
      mensaje,
      textoConfirmar: opciones?.textoConfirmar || 'Confirmar',
      textoCancelar: opciones?.textoCancelar || 'Cancelar',
      accionConfirmar
    };
    this.mostrarModalConfirmacion = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModalConfirmacion() {
    this.mostrarModalConfirmacion = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.cdr.detectChanges();
  }

  confirmarAccion() {
    const accion = this.confirmacion.accionConfirmar;
    this.cerrarModalConfirmacion();
    if (accion) {
      accion();
    }
  }

  cancelarEstudio(id: string) {
    this.abrirConfirmacion(
      'Cancelar estudio',
      'Seguro que quieres cancelar este estudio?',
      () => {
        this.isLoading = true;
        this.cdr.detectChanges();
        this.estudiosService.cambiarEstado(id, 'cancelado').subscribe({
          next: (response: any) => {
            this.isLoading = false;
            if (response.success) {
              this.cargarEstudios();
              this.cerrarModalDetalle();
              this.showToast('Estudio cancelado', 'success');
            }
            this.cdr.detectChanges();
          },
          error: (error: any) => {
            this.isLoading = false;
            this.showToast('Error al cancelar el estudio', 'error');
            this.cdr.detectChanges();
          }
        });
      },
      { textoConfirmar: 'Si, cancelar' }
    );
  }

  cancelarEstudioDesdeDetalle(id: string) {
    this.cancelarEstudio(id);
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
    this.cargarEstudios();
    this.showToast('Estudios actualizados', 'info');
  }
}