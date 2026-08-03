import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CitasService, Cita } from '../../services/citas.service';
import { SearchService } from '../../services/search.service';

@Component({
  selector: 'app-citas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './citas.component.html',
  styleUrls: ['./citas.component.css']
})
export class CitasComponent implements OnInit {
  citasOriginales: Cita[] = [];
  citas: Cita[] = [];
  citasFiltradas: Cita[] = [];
  terminoBusqueda: string = '';
  filtroActual: string = 'todas';
  mostrarModal: boolean = false;
  mostrarModalDetalle: boolean = false;
  citaSeleccionada: Cita | null = null;
  editandoId: string | null = null;
  esReagendar: boolean = false;
  esEdicion: boolean = false;
  isLoading: boolean = false;
  isLoadingBusqueda: boolean = false;
  errorMessage: string = '';
  fechaMinima: string = '';

  citaExpandidaId: string | null = null;

  mostrarModalConfirmacion: boolean = false;
  confirmacion = {
    titulo: '',
    mensaje: '',
    textoConfirmar: 'Confirmar',
    textoCancelar: 'Cancelar',
    accionConfirmar: () => {}
  };

  vistaActual: 'lista' | 'mes' | 'semana' | 'dia' = 'lista';
  mesActual: number = new Date().getMonth() + 1;
  anioActual: number = new Date().getFullYear();
  fechaSeleccionada: Date = new Date();

  semanaActual: Date[] = [];
  citasPorHora: { hora: string; citas: Cita[] }[] = [];
  diasDelMes: { fecha: Date; dia: number; citas: Cita[] }[] = [];

  itemsPorPagina: number = 10;
  paginaActual: number = 1;
  Math = Math;

  // ✅ Resultados de Elasticsearch (cache separado, nunca pisa this.citas)
  citasResultados: Cita[] = [];

  private searchSubject = new Subject<string>();
  private readonly MIN_SEARCH_CHARS = 1;

  nuevaCita = {
    titulo: '',
    especialidad: '',
    fecha: '',
    hora: '',
    tipo: 'Presencial' as 'Presencial' | 'Virtual',
    lugar: '',
    notas: ''
  };

  constructor(
    private citasService: CitasService,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.fechaMinima = this.formatearFechaLocal(new Date());
    this.nuevaCita.fecha = this.formatearFechaLocal(new Date());
    this.generarSemanaActual();
    this.generarHorasDelDia();
    this.generarCalendarioMes();

    if (isPlatformBrowser(this.platformId)) {
      this.cargarCitas();
    }

    // ==================== Búsqueda con Elasticsearch ====================
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((termino) => {
        if (termino.trim().length < this.MIN_SEARCH_CHARS) {
          this.isLoadingBusqueda = false;
          this.citasResultados = [];
          this.filtrarCitas();
          return [];
        }
        this.isLoadingBusqueda = true;
        return this.searchService.buscarModulo('citas', termino, this.getFiltrosElasticsearch());
      })
    ).subscribe({
      next: (response: any) => {
        this.isLoadingBusqueda = false;
        if (response && response.success && response.data?.resultados?.length > 0) {
          this.citasResultados = response.data.resultados.map((r: any) => ({
            id: r.id,
            titulo: r.datos?.titulo || r.titulo || '',
            especialidad: r.datos?.especialidad || r.especialidad || '',
            fecha: r.datos?.fecha || r.fecha || '',
            hora: r.datos?.hora || r.hora || '',
            tipo: r.datos?.tipo || r.tipo || 'Presencial',
            lugar: r.datos?.lugar || r.lugar || '',
            notas: r.datos?.notas || r.notas || '',
            estado: r.datos?.estado || r.estado || 'pendiente',
            recordatorio: r.datos?.recordatorio || false
          }));
        } else {
          this.citasResultados = [];
        }
        this.filtrarCitas();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingBusqueda = false;
        this.citasResultados = [];
        this.filtrarCitas();
      }
    });
  }

  private getFiltrosElasticsearch(): any {
    const filtros: any = {};
    if (this.filtroActual === 'pendientes') {
      filtros.estado = 'pendiente';
    } else if (this.filtroActual === 'completadas') {
      filtros.estado = 'completada';
    } else if (this.filtroActual === 'canceladas') {
      filtros.estado = 'cancelada';
    }
    return filtros;
  }

  private indexarCitasEnElasticsearch(citas: Cita[]) {
    for (const cita of citas) {
      if (cita.id) {
        const documento = {
          id: cita.id,
          titulo: cita.titulo.replace(/\./g, ' '),
          especialidad: cita.especialidad,
          fecha: cita.fecha,
          hora: cita.hora,
          tipo: cita.tipo,
          lugar: cita.lugar || '',
          notas: cita.notas || '',
          estado: cita.estado,
          recordatorio: cita.recordatorio || false
        };
        this.searchService.indexar('citas', documento).subscribe();
      }
    }
  }

  private indexarCita(cita: Cita) {
    if (cita.id) {
      const documento = {
        id: cita.id,
        titulo: cita.titulo.replace(/\./g, ' '),
        especialidad: cita.especialidad,
        fecha: cita.fecha,
        hora: cita.hora,
        tipo: cita.tipo,
        lugar: cita.lugar || '',
        notas: cita.notas || '',
        estado: cita.estado,
        recordatorio: cita.recordatorio || false
      };
      this.searchService.indexar('citas', documento).subscribe();
    }
  }

  get totalPaginas(): number {
    return Math.ceil(this.citasFiltradas.length / this.itemsPorPagina);
  }

  get citasPaginadas(): Cita[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.citasFiltradas.slice(inicio, inicio + this.itemsPorPagina);
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

  toggleCita(id: string) {
    this.citaExpandidaId = this.citaExpandidaId === id ? null : id;
  }

  cargarCitas() {
    this.isLoading = true;
    this.errorMessage = '';

    this.citasService.getCitas().subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.success && response.data) {
          this.citasOriginales = response.data;
          this.citas = response.data;
          this.marcarCitasVencidasComoCompletadas();
          this.indexarCitasEnElasticsearch(response.data);
          this.cdr.detectChanges();
          setTimeout(() => this.cdr.detectChanges(), 50);
        } else {
          this.citasOriginales = [];
          this.citas = [];
          this.cdr.detectChanges();
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = error?.error?.error || 'Error al cargar las citas';
        this.citasOriginales = [];
        this.citas = [];
        this.cdr.detectChanges();
        this.showToast('Error al cargar las citas', 'error');
      }
    });
  }

  private marcarCitasVencidasComoCompletadas() {
    const hoy = this.formatearFechaLocal(new Date());
    const vencidas = this.citas.filter(c => c.estado === 'pendiente' && c.fecha < hoy && c.id);

    if (vencidas.length === 0) {
      this.filtrarCitas();
      this.actualizarVista();
      this.cdr.detectChanges();
      return;
    }

    const cambios = vencidas.map(c => this.citasService.cambiarEstadoCita(c.id!, 'completada'));
    forkJoin(cambios).subscribe({
      next: () => {
        vencidas.forEach(v => { v.estado = 'completada'; });
        this.indexarCitasEnElasticsearch(vencidas);
        this.filtrarCitas();
        this.actualizarVista();
        this.cdr.detectChanges();
      },
      error: () => {
        this.filtrarCitas();
        this.actualizarVista();
        this.cdr.detectChanges();
      }
    });
  }

  // ✅ METODO PRINCIPAL DE FILTRADO - igual que en tratamientos
  filtrarCitas() {
    const usarBusquedaES = this.terminoBusqueda.trim().length >= this.MIN_SEARCH_CHARS
      && this.citasResultados.length > 0;

    let filtrados = usarBusquedaES ? [...this.citasResultados] : [...this.citas];

    if (this.filtroActual === 'pendientes') {
      filtrados = filtrados.filter(c => c.estado === 'pendiente');
    } else if (this.filtroActual === 'completadas') {
      filtrados = filtrados.filter(c => c.estado === 'completada');
    } else if (this.filtroActual === 'canceladas') {
      filtrados = filtrados.filter(c => c.estado === 'cancelada');
    }

    // Si venimos de Elasticsearch, el término ya se aplicó en el backend
    if (!usarBusquedaES && this.terminoBusqueda.trim()) {
      const term = this.terminoBusqueda.toLowerCase();
      filtrados = filtrados.filter(c =>
        c.titulo.toLowerCase().includes(term) ||
        c.especialidad.toLowerCase().includes(term) ||
        (c.lugar && c.lugar.toLowerCase().includes(term))
      );
    }

    this.citasFiltradas = filtrados;
    this.paginaActual = 1;
    this.cdr.detectChanges();
  }

  onSearchChange(termino: string) {
    this.terminoBusqueda = termino;
    this.searchSubject.next(termino);
  }

  cambiarFiltro(filtro: string) {
    this.filtroActual = filtro;
    this.paginaActual = 1;
    this.filtrarCitas();
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
        citas: []
      });
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha = new Date(this.anioActual, this.mesActual - 1, dia);
      const fechaStr = this.formatearFechaLocal(fecha);
      const citasDelDia = this.citasFiltradas.filter(c => c.fecha === fechaStr);

      this.diasDelMes.push({
        fecha,
        dia,
        citas: citasDelDia
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

  getCitasDelDia(fecha: Date): Cita[] {
    const fechaStr = this.formatearFechaLocal(fecha);
    return this.citasFiltradas.filter(c => c.fecha === fechaStr);
  }

  generarHorasDelDia() {
    this.citasPorHora = [];
    const fechaStr = this.formatearFechaLocal(this.fechaSeleccionada);
    const citasDelDia = this.citasFiltradas.filter(c => c.fecha === fechaStr);

    for (let h = 6; h <= 22; h++) {
      const horaStr = `${h.toString().padStart(2, '0')}:00`;
      const citasEnHora = citasDelDia.filter(c => c.hora.startsWith(horaStr.substring(0, 2)));

      this.citasPorHora.push({
        hora: horaStr,
        citas: citasEnHora
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

  formatearFechaLocal(fecha: Date): string {
    const y = fecha.getFullYear();
    const m = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const d = fecha.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
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

  formatearHora(hora: string): string {
    if (!hora) return '';
    const [h, m] = hora.split(':');
    const horaNum = parseInt(h);
    const sufijo = horaNum >= 12 ? 'PM' : 'AM';
    const hora12 = horaNum % 12 || 12;
    return `${hora12}:${m} ${sufijo}`;
  }

  obtenerNombreDia(fecha: Date): string {
    const dias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    return dias[fecha.getDay()];
  }

  obtenerNombreMes(mes: number): string {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[mes - 1];
  }

  obtenerFechaMinima(): string {
    return this.formatearFechaLocal(new Date());
  }

  verDetalleCita(cita: Cita) {
    this.citaSeleccionada = cita;
    this.mostrarModalDetalle = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModalDetalle() {
    this.mostrarModalDetalle = false;
    this.citaSeleccionada = null;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.cdr.detectChanges();
  }

  abrirModal(cita?: Cita) {
    this.errorMessage = '';
    this.esReagendar = false;
    this.esEdicion = false;

    if (cita) {
      const hoy = this.formatearFechaLocal(new Date());
      if (cita.fecha < hoy) {
        this.showToast('No se puede editar una cita con fecha pasada', 'warning');
        return;
      }
      this.esEdicion = true;
      this.editandoId = cita.id || null;
      this.nuevaCita = {
        titulo: cita.titulo,
        especialidad: cita.especialidad,
        fecha: cita.fecha,
        hora: cita.hora,
        tipo: cita.tipo,
        lugar: cita.lugar || '',
        notas: cita.notas || ''
      };
    } else {
      this.editandoId = null;
      this.resetFormulario();
    }
    this.mostrarModal = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
  }

  reagendarCitaDesdeDetalle(cita: Cita) {
    this.cerrarModalDetalle();
    this.esReagendar = true;
    this.esEdicion = false;
    this.editandoId = cita.id || null;
    this.nuevaCita = {
      titulo: cita.titulo,
      especialidad: cita.especialidad,
      fecha: cita.fecha,
      hora: cita.hora,
      tipo: cita.tipo,
      lugar: cita.lugar || '',
      notas: cita.notas || ''
    };
    this.mostrarModal = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
  }

  editarCitaDesdeDetalle(cita: Cita) {
    this.cerrarModalDetalle();
    this.abrirModal(cita);
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.esReagendar = false;
    this.esEdicion = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.editandoId = null;
    this.resetFormulario();
    this.errorMessage = '';
  }

  resetFormulario() {
    const hoy = new Date();
    this.nuevaCita = {
      titulo: '',
      especialidad: '',
      fecha: this.formatearFechaLocal(hoy),
      hora: '09:00',
      tipo: 'Presencial',
      lugar: '',
      notas: ''
    };
  }

  guardarCita() {
    if (!this.nuevaCita.titulo || !this.nuevaCita.especialidad || !this.nuevaCita.fecha || !this.nuevaCita.hora) {
      this.errorMessage = 'Por favor completa todos los campos obligatorios';
      this.showToast(this.errorMessage, 'warning');
      return;
    }

    if (this.esEdicion && !this.esReagendar) {
      const data = {
        titulo: this.nuevaCita.titulo,
        especialidad: this.nuevaCita.especialidad,
        tipo: this.nuevaCita.tipo,
        lugar: this.nuevaCita.lugar,
        notas: this.nuevaCita.notas
      };

      this.isLoading = true;
      this.errorMessage = '';

      this.citasService.updateCita(this.editandoId!, data).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.success) {
            this.cargarCitas();
            this.cerrarModal();
            this.showToast('Cita actualizada correctamente', 'success');
          } else {
            this.errorMessage = response.error || 'Error al actualizar';
            this.showToast(this.errorMessage, 'error');
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error?.error?.error || 'Error al actualizar';
          this.showToast(this.errorMessage, 'error');
        }
      });
      return;
    }

    if (!this.esEdicion && this.nuevaCita.fecha < this.obtenerFechaMinima()) {
      this.errorMessage = 'La fecha no puede ser un dia que ya paso';
      this.showToast(this.errorMessage, 'warning');
      return;
    }

    const data = {
      titulo: this.nuevaCita.titulo,
      especialidad: this.nuevaCita.especialidad,
      fecha: this.nuevaCita.fecha,
      hora: this.nuevaCita.hora,
      tipo: this.nuevaCita.tipo,
      lugar: this.nuevaCita.lugar,
      notas: this.nuevaCita.notas
    };

    this.isLoading = true;
    this.errorMessage = '';

    if (this.editandoId) {
      this.citasService.updateCita(this.editandoId, data).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.success) {
            this.cargarCitas();
            this.cerrarModal();
            this.showToast(
              this.esReagendar ? 'Cita reagendada correctamente' : 'Cita actualizada correctamente',
              'success'
            );
            if (response.data) {
              this.indexarCita(response.data);
            }
          } else {
            this.errorMessage = response.error || 'Error al actualizar';
            this.showToast(this.errorMessage, 'error');
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error?.error?.error || 'Error al actualizar';
          this.showToast(this.errorMessage, 'error');
        }
      });
    } else {
      this.citasService.createCita(data).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response.success) {
            this.cargarCitas();
            this.cerrarModal();
            this.showToast('Cita registrada correctamente', 'success');
            if (response.data) {
              this.indexarCita(response.data);
            }
          } else {
            this.errorMessage = response.error || 'Error al guardar';
            this.showToast(this.errorMessage, 'error');
          }
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error?.error?.error || 'Error al guardar';
          this.showToast(this.errorMessage, 'error');
        }
      });
    }
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

  cancelarCita(id: string) {
    this.abrirConfirmacion(
      'Cancelar cita',
      '¿Seguro que quieres cancelar esta cita? Podrás editarla después.',
      () => {
        this.isLoading = true;
        this.cdr.detectChanges();
        this.citasService.cambiarEstadoCita(id, 'cancelada').subscribe({
          next: (response: any) => {
            this.isLoading = false;
            if (response.success) {
              this.cargarCitas();
              this.cerrarModalDetalle();
              this.showToast('Cita cancelada', 'success');
              const cita = this.citas.find(c => c.id === id);
              if (cita) {
                this.indexarCita(cita);
              }
            }
            this.cdr.detectChanges();
          },
          error: (error: any) => {
            this.isLoading = false;
            this.showToast('Error al cancelar la cita', 'error');
            this.cdr.detectChanges();
          }
        });
      },
      { textoConfirmar: 'Sí, cancelar' }
    );
  }

  cancelarCitaDesdeDetalle(id: string) {
    this.cancelarCita(id);
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
    this.cargarCitas();
    this.showToast('Citas actualizadas', 'info');
  }
}