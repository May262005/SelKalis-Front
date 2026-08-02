import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { TratamientosService, Tratamiento, Medicamento, TomaRealizada, HistorialAjuste } from '../../services/tratamientos.service';
import { SearchService } from '../../services/search.service';

@Component({
  selector: 'app-tratamientos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tratamientos.component.html',
  styleUrls: ['./tratamientos.component.css']
})
export class TratamientosComponent implements OnInit {
  tratamientos: Tratamiento[] = [];
  tratamientosOriginal: Tratamiento[] = [];
  tratamientosFiltrados: Tratamiento[] = [];
  terminoBusqueda: string = '';
  filtroActual: string = 'todos';
  filtroMedicamentos: string = 'todos';
  tratamientoExpandido: number | string | null = null;
  hoy: Date = new Date();
  isLoading: boolean = false;
  isLoadingMedicamentos: boolean = false;
  isLoadingHistorial: boolean = false;
  isLoadingAjuste: boolean = false;
  isLoadingTratamiento: boolean = false;
  isLoadingSuspension: boolean = false;
  isLoadingMedicamento: boolean = false;
  isLoadingEditarMedicamento: boolean = false;
  isLoadingBusqueda: boolean = false;
  errorMessage: string = '';
  errorGuardando: string = '';

  vistaActual: 'tratamientos' | 'medicamentos' = 'tratamientos';

  itemsPorPagina: number = 10;
  paginaActual: number = 1;
  paginaMedicamentos: number = 1;
  Math = Math;

  private searchSubject = new Subject<string>();
  private readonly MIN_SEARCH_CHARS = 2;

  medicamentosResultados: { tratamientoId: string; tratamientoNombre: string; tratamientoEstado: string; medicamento: Medicamento }[] = [];

  // Modal Tratamiento
  mostrarModalTratamiento: boolean = false;
  editandoTratamientoId: string | null = null;
  nuevoTratamiento = {
    nombre: '',
    diagnostico: '',
    fechaInicio: '',
    notas: ''
  };
  medicamentosTemp: any[] = [];

  // Modal Medicamento
  mostrarModalMedicamento: boolean = false;
  tratamientoIdActivo: string | null = null;
  nuevoMedicamentoSimple = {
    nombre: '',
    concentracion: '',
    dosis: '',
    frecuencia: 'Cada 8 horas',
    horaInicio: '',
    duracionDias: 7,
    instrucciones: ''
  };

  // Modal Editar Medicamento
  mostrarModalEditarMedicamento: boolean = false;
  medicamentoEditando: Medicamento | null = null;
  medicamentoEditandoTratamientoId: string | null = null;
  medicamentoEditandoData = {
    nombre: '',
    concentracion: '',
    dosis: '',
    frecuencia: 'Cada 8 horas',
    horaInicio: '',
    duracionDias: 7,
    instrucciones: ''
  };

  // Modal de Ajuste
  mostrarModalAjuste: boolean = false;
  medicamentoAjusteId: string | null = null;
  tipoAjuste: 'extender' | 'cambiar_frecuencia' | 'suspender' | null = null;
  datosAjuste = {
    diasExtra: 7,
    nuevaFrecuencia: 'Cada 8 horas',
    razon: ''
  };

  // Modal Suspender Tratamiento
  mostrarModalSuspenderTratamiento: boolean = false;
  tratamientoSuspensionId: string | null = null;
  datosSuspension = {
    razon: ''
  };

  // Modal Confirmacion
  mostrarModalConfirmacion: boolean = false;
  confirmacion = {
    titulo: '',
    mensaje: '',
    textoConfirmar: 'Eliminar',
    textoCancelar: 'Cancelar',
    tipo: 'danger' as 'danger' | 'default',
    accionConfirmar: () => {}
  };

  // Modal Historial
  mostrarModalHistorial: boolean = false;
  historialMedicamento: HistorialAjuste[] = [];
  nombreMedicamentoHistorial: string = '';

  private static MARGEN_TOMA_MINUTOS = 30;

  horariosPorFrecuencia: { [key: string]: (horaInicio: string) => string[] } = {
    'Cada 4 horas': (horaInicio: string) => {
      const horas = [horaInicio];
      let hora = horaInicio;
      for (let i = 1; i < 6; i++) {
        hora = this.sumarHoras(hora, 4);
        horas.push(hora);
      }
      return horas;
    },
    'Cada 6 horas': (horaInicio: string) => {
      const horas = [horaInicio];
      let hora = horaInicio;
      for (let i = 1; i < 4; i++) {
        hora = this.sumarHoras(hora, 6);
        horas.push(hora);
      }
      return horas;
    },
    'Cada 8 horas': (horaInicio: string) => {
      const horas = [horaInicio];
      let hora = horaInicio;
      for (let i = 1; i < 3; i++) {
        hora = this.sumarHoras(hora, 8);
        horas.push(hora);
      }
      return horas;
    },
    'Cada 12 horas': (horaInicio: string) => {
      return [horaInicio, this.sumarHoras(horaInicio, 12)];
    },
    'Una vez al dia': (horaInicio: string) => {
      return [horaInicio];
    },
    'Segun necesidad': () => {
      return ['Cuando sea necesario'];
    }
  };

  constructor(
    private tratamientosService: TratamientosService,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.nuevoTratamiento.fechaInicio = this.formatearFechaLocal(new Date());
      this.nuevoMedicamentoSimple.horaInicio = this.obtenerHoraActual();
      this.cargarTratamientos();
      setInterval(() => {
        this.hoy = new Date();
        this.cdr.detectChanges();
      }, 60000);
    }

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((termino) => {
        if (termino.trim().length < this.MIN_SEARCH_CHARS) {
          this.isLoadingBusqueda = false;
          this.medicamentosResultados = [];
          this.restaurarListaOriginal();
          return [];
        }
        this.isLoadingBusqueda = true;
        return forkJoin({
          tratamientos: this.searchService.buscarModulo('tratamientos', termino, this.getFiltrosTratamientos()),
          medicamentos: this.searchService.buscarModulo('medicamentos', termino)
        });
      })
    ).subscribe({
      next: (response: any) => {
        this.isLoadingBusqueda = false;
        
        let resultadosTratamientos: any[] = [];
        if (response.tratamientos?.success && response.tratamientos?.data?.resultados?.length > 0) {
          resultadosTratamientos = response.tratamientos.data.resultados.map((r: any) => ({
            id: r.id,
            nombre: r.datos?.nombre || r.titulo || '',
            diagnostico: r.datos?.diagnostico || r.descripcion || '',
            fecha_inicio: r.datos?.fecha_inicio || r.fecha || '',
            fecha_fin: r.datos?.fecha_fin || '',
            notas: r.datos?.notas || '',
            estado: r.datos?.estado || r.estado || 'activo',
            activo: r.datos?.activo !== false,
            medicamentos: r.datos?.medicamentos || [],
            historial_ajustes: r.datos?.historial_ajustes || [],
            ultimo_ajuste: r.datos?.ultimo_ajuste || ''
          }));
        }
        
        let resultadosMedicamentos: any[] = [];
        if (response.medicamentos?.success && response.medicamentos?.data?.resultados?.length > 0) {
          resultadosMedicamentos = response.medicamentos.data.resultados.map((r: any) => {
            const datos = r.datos || r;
            const tratamientoId = datos.tratamiento_id || '';
            const tratamiento = this.tratamientosOriginal.find(t => t.id === tratamientoId);
            
            return {
              tratamientoId: tratamientoId,
              tratamientoNombre: tratamiento?.nombre || datos.tratamiento_nombre || 'Sin tratamiento',
              tratamientoEstado: tratamiento?.estado || 'activo',
              medicamento: {
                id: r.id,
                nombre: datos.nombre || r.titulo || '',
                concentracion: datos.concentracion || '',
                dosis: datos.dosis || '',
                frecuencia: datos.frecuencia || '',
                hora_inicio: datos.hora_inicio || '',
                duracion_dias: datos.duracion_dias || 0,
                instrucciones: datos.instrucciones || '',
                activo: datos.activo !== false,
                tomas: datos.tomas || [],
                horariosCalculados: this.calcularHorarios(datos.frecuencia || '', datos.hora_inicio || ''),
                historial_ajustes: datos.historial_ajustes || []
              }
            };
          });
        }
        
        if (resultadosTratamientos.length > 0 || resultadosMedicamentos.length > 0) {
          if (resultadosTratamientos.length > 0) {
            this.tratamientos = resultadosTratamientos;
            this.aplicarFiltrosLocales();
          } else {
            this.tratamientos = [];
            this.tratamientosFiltrados = [];
          }
          
          this.medicamentosResultados = resultadosMedicamentos;
          
          if (resultadosMedicamentos.length > 0 && this.vistaActual === 'tratamientos') {
            this.vistaActual = 'medicamentos';
            this.paginaMedicamentos = 1;
          }
          
          this.cdr.detectChanges();
        } else {
          this.tratamientos = [];
          this.tratamientosFiltrados = [];
          this.medicamentosResultados = [];
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.isLoadingBusqueda = false;
        this.restaurarListaOriginal();
        this.cdr.detectChanges();
      }
    });
  }

  private restaurarListaOriginal() {
    this.tratamientos = [...this.tratamientosOriginal];
    this.medicamentosResultados = [];
    this.aplicarFiltrosLocales();
    this.cdr.detectChanges();
  }

  private aplicarFiltrosLocales() {
    let filtrados = [...this.tratamientos];
    const hoy = this.formatearFechaLocal(new Date());

    if (this.filtroActual === 'suspendidos') {
      filtrados = filtrados.filter((t: Tratamiento) => t.activo === false);
    } else if (this.filtroActual === 'sin_completar') {
      filtrados = filtrados.filter((t: Tratamiento) => {
        if (t.activo === false) return false;
        if (t.estado !== 'activo') return false;
        if (t.fecha_fin >= hoy) return false;
        const progreso = this.calcularProgresoTratamiento(t);
        return progreso < 100;
      });
    } else if (this.filtroActual === 'en_curso') {
      filtrados = filtrados.filter((t: Tratamiento) => {
        if (t.activo === false) return false;
        if (t.estado !== 'activo') return false;
        return t.fecha_inicio <= hoy && t.fecha_fin >= hoy;
      });
    } else if (this.filtroActual === 'completados') {
      filtrados = filtrados.filter((t: Tratamiento) => t.estado === 'completado');
    }

    this.tratamientosFiltrados = filtrados;
    this.paginaActual = 1;
    this.cdr.detectChanges();
  }

  private getFiltrosTratamientos(): any {
    const filtros: any = {};
    if (this.filtroActual === 'en_curso') {
      filtros.estado = 'activo';
      filtros.activo = true;
    } else if (this.filtroActual === 'completados') {
      filtros.estado = 'completado';
    } else if (this.filtroActual === 'suspendidos') {
      filtros.activo = false;
    }
    return filtros;
  }

  private indexarTratamientosEnElasticsearch(tratamientos: any[]) {
    for (const tratamiento of tratamientos) {
      if (tratamiento.id) {
        const documento = {
          id: tratamiento.id,
          nombre: tratamiento.nombre,
          diagnostico: tratamiento.diagnostico || '',
          fecha_inicio: tratamiento.fecha_inicio,
          fecha_fin: tratamiento.fecha_fin || '',
          notas: tratamiento.notas || '',
          estado: tratamiento.estado,
          activo: tratamiento.activo !== false
        };
        this.searchService.indexar('tratamientos', documento).subscribe();
        
        if (tratamiento.medicamentos) {
          for (const med of tratamiento.medicamentos) {
            if (med.id) {
              const medDoc = {
                id: med.id,
                nombre: med.nombre,
                concentracion: med.concentracion || '',
                dosis: med.dosis || '',
                frecuencia: med.frecuencia,
                duracion_dias: med.duracion_dias,
                instrucciones: med.instrucciones || '',
                tratamiento_id: tratamiento.id,
                tratamiento_nombre: tratamiento.nombre,
                activo: med.activo !== false
              };
              this.searchService.indexar('medicamentos', medDoc).subscribe();
            }
          }
        }
      }
    }
  }

  private indexarTratamiento(tratamiento: any) {
    if (tratamiento.id) {
      const documento = {
        id: tratamiento.id,
        nombre: tratamiento.nombre,
        diagnostico: tratamiento.diagnostico || '',
        fecha_inicio: tratamiento.fecha_inicio,
        fecha_fin: tratamiento.fecha_fin || '',
        notas: tratamiento.notas || '',
        estado: tratamiento.estado,
        activo: tratamiento.activo !== false
      };
      this.searchService.indexar('tratamientos', documento).subscribe();
    }
  }

  private indexarMedicamento(medicamento: any, tratamientoId: string, tratamientoNombre: string) {
    if (medicamento.id) {
      const medDoc = {
        id: medicamento.id,
        nombre: medicamento.nombre,
        concentracion: medicamento.concentracion || '',
        dosis: medicamento.dosis || '',
        frecuencia: medicamento.frecuencia,
        duracion_dias: medicamento.duracion_dias,
        instrucciones: medicamento.instrucciones || '',
        tratamiento_id: tratamientoId,
        tratamiento_nombre: tratamientoNombre,
        activo: medicamento.activo !== false
      };
      this.searchService.indexar('medicamentos', medDoc).subscribe();
    }
  }

  get totalPaginas(): number {
    return Math.ceil(this.tratamientosFiltrados.length / this.itemsPorPagina);
  }

  get tratamientosPaginados(): Tratamiento[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.tratamientosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  get medicamentosFiltrados(): { tratamientoId: string; tratamientoNombre: string; tratamientoEstado: string; medicamento: Medicamento }[] {
    if (this.terminoBusqueda.trim().length >= this.MIN_SEARCH_CHARS && this.medicamentosResultados.length > 0) {
      return this.medicamentosResultados;
    }
    
    let resultado: { tratamientoId: string; tratamientoNombre: string; tratamientoEstado: string; medicamento: Medicamento }[] = [];
    const hoy = this.formatearFechaLocal(new Date());

    for (const trat of this.tratamientos) {
      if (trat.estado === 'completado' && this.filtroMedicamentos !== 'todos' && this.filtroMedicamentos !== 'completados') {
        continue;
      }

      for (const med of (trat.medicamentos || [])) {
        let incluir = true;

        switch (this.filtroMedicamentos) {
          case 'todos':
            incluir = true;
            break;
          case 'en_curso':
            incluir = trat.activo !== false && 
                     trat.estado === 'activo' &&
                     trat.fecha_inicio <= hoy &&
                     trat.fecha_fin >= hoy &&
                     med.activo !== false;
            break;
          case 'sin_completar':
            incluir = trat.activo !== false &&
                     trat.estado === 'activo' &&
                     trat.fecha_fin < hoy &&
                     med.activo !== false;
            break;
          case 'completados':
            incluir = trat.estado === 'completado';
            break;
          case 'suspendidos':
            incluir = trat.activo === false || med.activo === false;
            break;
          default:
            incluir = true;
        }

        if (incluir) {
          resultado.push({
            tratamientoId: trat.id as string,
            tratamientoNombre: trat.nombre,
            tratamientoEstado: trat.estado,
            medicamento: med
          });
        }
      }
    }

    if (this.terminoBusqueda.trim()) {
      const term = this.terminoBusqueda.toLowerCase().trim();
      resultado = resultado.filter((r: any) =>
        r.medicamento.nombre.toLowerCase().includes(term) ||
        r.tratamientoNombre.toLowerCase().includes(term)
      );
    }

    return resultado;
  }

  get totalPaginasMedicamentos(): number {
    return Math.ceil(this.medicamentosFiltrados.length / this.itemsPorPagina);
  }

  get medicamentosPaginados(): { tratamientoId: string; tratamientoNombre: string; tratamientoEstado: string; medicamento: Medicamento }[] {
    const inicio = (this.paginaMedicamentos - 1) * this.itemsPorPagina;
    return this.medicamentosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
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

  obtenerPaginasMedicamentos(): number[] {
    const total = this.totalPaginasMedicamentos;
    const actual = this.paginaMedicamentos;
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
      this.tratamientoExpandido = null;
      this.cdr.detectChanges();
    }
  }

  cambiarPaginaMedicamentos(pagina: number) {
    if (pagina >= 1 && pagina <= this.totalPaginasMedicamentos) {
      this.paginaMedicamentos = pagina;
      this.cdr.detectChanges();
    }
  }

  private formatearFechaLocal(fecha: Date): string {
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
    if (hora24 === 'Cuando sea necesario') return hora24;
    const partes = hora24.split(':');
    let h = parseInt(partes[0], 10);
    const m = (partes[1] || '00').padStart(2, '0');
    if (isNaN(h)) return hora24;
    const sufijo = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${sufijo}`;
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

  private crearFechaHoraToma(fecha: string, hora: string): Date {
    const [h, m] = hora.split(':').map(Number);
    const dt = new Date(fecha + 'T00:00:00');
    dt.setHours(h || 0, m || 0, 0, 0);
    return dt;
  }

  puedeMarcarToma(toma: TomaRealizada): boolean {
    if (toma.completado) return false;
    const horaProgramada = this.crearFechaHoraToma(toma.fecha, toma.hora);
    const horaLimite = new Date(horaProgramada.getTime() + TratamientosComponent.MARGEN_TOMA_MINUTOS * 60 * 1000);
    const ahora = new Date();
    return ahora >= horaProgramada && ahora <= horaLimite;
  }

  obtenerTomasFuturas(tratamientoId: string, medicamentoId: string): TomaRealizada[] {
    const hoyStr = this.formatearFechaLocal(this.hoy);
    
    const tratamiento = this.tratamientos.find((t: Tratamiento) => t.id === tratamientoId);
    if (!tratamiento) return [];
    const medicamento = tratamiento.medicamentos?.find((m: Medicamento) => m.id === medicamentoId);
    if (!medicamento) return [];
    
    if (medicamento.activo === false || tratamiento.estado !== 'activo') return [];
    
    const tomasHoy = (medicamento.tomas || [])
      .filter((t: TomaRealizada) => t.fecha === hoyStr);
    
    return tomasHoy
      .sort((a, b) => {
        const horaA = new Date(a.fecha + 'T' + a.hora + ':00');
        const horaB = new Date(b.fecha + 'T' + b.hora + ':00');
        return horaA.getTime() - horaB.getTime();
      });
  }

  obtenerTextoAjuste(ajuste: HistorialAjuste): string {
    switch (ajuste.tipo) {
      case 'extender':
        return `Extendido ${ajuste.diasExtra} dias (total: ${ajuste.nuevaDuracion} dias)`;
      case 'cambiar_frecuencia':
        return `Frecuencia cambiada: ${ajuste.frecuenciaAnterior} -> ${ajuste.frecuenciaNueva}`;
      case 'suspender':
        return `Medicamento suspendido: ${ajuste.razon || 'Sin razon'}`;
      case 'reactivar':
        return `Medicamento reactivado: ${ajuste.razon || 'Sin razon'}`;
      case 'actualizar_datos':
        return 'Datos actualizados';
      default:
        return 'Ajuste realizado';
    }
  }

  obtenerProgresoTratamientoConNumero(tratamiento: Tratamiento): string {
    let totalMedicamentos = 0;
    let medicamentosCompletados = 0;
    
    for (const med of (tratamiento.medicamentos || [])) {
      if (med.activo === false) continue;
      totalMedicamentos++;
      const progreso = this.calcularProgresoMedicamento(med);
      if (progreso >= 100) {
        medicamentosCompletados++;
      }
    }
    
    if (totalMedicamentos === 0) return '0% (0/0 medicamentos)';
    
    const porcentaje = Math.round((medicamentosCompletados / totalMedicamentos) * 100);
    return `${porcentaje}% (${medicamentosCompletados}/${totalMedicamentos} medicamentos)`;
  }

  obtenerProgresoMedicamentoConNumero(medicamento: Medicamento): string {
    const tomas = medicamento.tomas || [];
    const total = tomas.length;
    if (total === 0) return '0% (0/0 tomas)';
    const completadas = tomas.filter((t: TomaRealizada) => t.completado).length;
    const porcentaje = Math.round((completadas / total) * 100);
    return `${porcentaje}% (${completadas}/${total} tomas)`;
  }

  cambiarVista(vista: 'tratamientos' | 'medicamentos') {
    this.vistaActual = vista;
    this.paginaActual = 1;
    this.paginaMedicamentos = 1;
    if (vista === 'tratamientos') {
      this.restaurarListaOriginal();
    }
    this.cdr.detectChanges();
  }

  cambiarFiltro(filtro: string) {
    this.filtroActual = filtro;
    this.paginaActual = 1;
    this.paginaMedicamentos = 1;
    if (this.terminoBusqueda.trim().length >= this.MIN_SEARCH_CHARS) {
      this.searchSubject.next(this.terminoBusqueda);
    } else {
      this.aplicarFiltrosLocales();
    }
  }

  cambiarFiltroMedicamentos(filtro: string) {
    this.filtroMedicamentos = filtro;
    this.paginaMedicamentos = 1;
    this.cdr.detectChanges();
  }

  getTratamientosEnCurso(): Tratamiento[] {
    const hoy = this.formatearFechaLocal(new Date());
    return this.tratamientos.filter((t: Tratamiento) => 
      t.activo !== false && 
      t.estado === 'activo' && 
      t.fecha_inicio <= hoy &&
      t.fecha_fin >= hoy
    );
  }

  getTratamientoCompleto(tratamientoId: string): Tratamiento | null {
    return this.tratamientos.find((t: Tratamiento) => t.id === tratamientoId) || null;
  }

  isTratamientoEnCurso(tratamientoId: string): boolean {
    const hoy = this.formatearFechaLocal(new Date());
    const tratamiento = this.tratamientos.find((t: Tratamiento) => t.id === tratamientoId);
    if (!tratamiento) return false;
    if (tratamiento.activo === false) return false;
    if (tratamiento.estado !== 'activo') return false;
    return tratamiento.fecha_inicio <= hoy && tratamiento.fecha_fin >= hoy;
  }

  obtenerRazonSuspension(tratamiento: Tratamiento): string {
    if (!tratamiento.historial_ajustes || tratamiento.historial_ajustes.length === 0) {
      return 'No especificada';
    }
    const suspensiones = tratamiento.historial_ajustes.filter(a => a.tipo === 'suspender');
    if (suspensiones.length === 0) {
      return 'No especificada';
    }
    const ultimaSuspension = suspensiones[suspensiones.length - 1];
    return ultimaSuspension.razon || 'No especificada';
  }

  cargarTratamientos() {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.tratamientosService.getTratamientos().subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.success && response.data) {
          const transformados = this.transformarTratamientos(response.data);
          this.tratamientosOriginal = transformados;
          this.tratamientos = transformados;
          this.verificarYActualizarEstados();
          this.aplicarFiltrosLocales();
          this.indexarTratamientosEnElasticsearch(response.data);
          this.cdr.detectChanges();
          setTimeout(() => this.cdr.detectChanges(), 50);
        } else {
          this.tratamientos = [];
          this.tratamientosOriginal = [];
          this.aplicarFiltrosLocales();
          this.cdr.detectChanges();
        }
      },
      error: (error: any) => {
        this.isLoading = false;
        this.errorMessage = 'Error al cargar los tratamientos: ' + (this.obtenerMensajeError(error));
        this.tratamientos = [];
        this.tratamientosOriginal = [];
        this.aplicarFiltrosLocales();
        this.cdr.detectChanges();
        this.showToast('Error al cargar los tratamientos', 'error');
      }
    });
  }

  private verificarYActualizarEstados() {
    const hoy = this.formatearFechaLocal(new Date());
    let cambiosRealizados = false;

    for (const tratamiento of this.tratamientos) {
      if (tratamiento.activo === false) continue;
      
      const progreso = this.calcularProgresoTratamiento(tratamiento);
      
      if (progreso >= 100 && tratamiento.estado !== 'completado') {
        tratamiento.estado = 'completado';
        cambiosRealizados = true;
      }
    }

    if (cambiosRealizados) {
      this.showToast('Se actualizaron automaticamente algunos estados', 'info');
      this.cdr.detectChanges();
    }
  }

  transformarTratamientos(data: any[]): Tratamiento[] {
    return data.map((item: any) => ({
      id: item.id,
      nombre: item.nombre,
      diagnostico: item.diagnostico || '',
      fecha_inicio: item.fecha_inicio,
      fecha_fin: item.fecha_fin,
      notas: item.notas || '',
      estado: item.estado,
      activo: item.activo !== false,
      historial_ajustes: item.historial_ajustes || [],
      ultimo_ajuste: item.ultimo_ajuste,
      medicamentos: item.medicamentos ? item.medicamentos.map((med: any) => ({
        id: med.id,
        nombre: med.nombre,
        concentracion: med.concentracion || '',
        dosis: med.dosis || '',
        frecuencia: med.frecuencia,
        hora_inicio: med.hora_inicio,
        duracion_dias: med.duracion_dias,
        instrucciones: med.instrucciones || '',
        activo: med.activo !== false,
        fecha_suspension: med.fecha_suspension,
        ultimo_ajuste: med.ultimo_ajuste,
        historial_ajustes: med.historial_ajustes || [],
        horariosCalculados: this.calcularHorarios(med.frecuencia, med.hora_inicio),
        tomas: med.tomas || [],
        tratamiento_id: med.tratamiento_id
      })) : []
    }));
  }

  onSearchChange(termino: string) {
    this.terminoBusqueda = termino;
    
    if (termino.trim().length === 0) {
      this.restaurarListaOriginal();
      return;
    }
    
    this.searchSubject.next(termino);
  }

  toggleTratamiento(id: string | number) {
    this.tratamientoExpandido = this.tratamientoExpandido === id ? null : id;
    this.cdr.detectChanges();
  }

  sumarHoras(hora: string, horasASumar: number): string {
    const [h, m] = hora.split(':').map(Number);
    const fecha = new Date();
    fecha.setHours(h, m);
    fecha.setHours(fecha.getHours() + horasASumar);
    return `${fecha.getHours().toString().padStart(2, '0')}:${fecha.getMinutes().toString().padStart(2, '0')}`;
  }

  calcularHorarios(frecuencia: string, horaInicio: string): string[] {
    const calcular = this.horariosPorFrecuencia[frecuencia];
    return calcular ? calcular(horaInicio) : [horaInicio];
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

  // ==================== MODALES Y GUARDADO ====================

  abrirModalTratamiento(tratamiento?: Tratamiento) {
    this.errorGuardando = '';
    this.editandoTratamientoId = null;
    
    if (tratamiento) {
      this.editandoTratamientoId = tratamiento.id as string;
      this.nuevoTratamiento = {
        nombre: tratamiento.nombre,
        diagnostico: tratamiento.diagnostico || '',
        fechaInicio: tratamiento.fecha_inicio,
        notas: tratamiento.notas || ''
      };
      this.medicamentosTemp = [];
    } else {
      this.resetFormularioTratamiento();
    }
    
    this.mostrarModalTratamiento = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModalTratamiento() {
    this.mostrarModalTratamiento = false;
    this.errorGuardando = '';
    this.editandoTratamientoId = null;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.resetFormularioTratamiento();
    this.cdr.detectChanges();
  }

  resetFormularioTratamiento() {
    this.nuevoTratamiento = {
      nombre: '',
      diagnostico: '',
      fechaInicio: this.formatearFechaLocal(new Date()),
      notas: ''
    };
    this.medicamentosTemp = [];
    this.errorGuardando = '';
  }

  agregarMedicamentoTemp() {
    this.medicamentosTemp.push({
      id: Date.now() + Math.random(),
      nombre: '',
      concentracion: '',
      dosis: '',
      frecuencia: 'Cada 8 horas',
      horaInicio: this.obtenerHoraActual(),
      duracionDias: 7,
      instrucciones: ''
    });
    this.cdr.detectChanges();
  }

  eliminarMedicamentoTemp(index: number) {
    this.medicamentosTemp.splice(index, 1);
    this.cdr.detectChanges();
  }

  guardarTratamiento() {
    this.errorGuardando = '';
    
    if (!this.nuevoTratamiento.nombre) {
      this.errorGuardando = 'El nombre del tratamiento es obligatorio';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (this.editandoTratamientoId) {
      const data = {
        nombre: this.nuevoTratamiento.nombre,
        diagnostico: this.nuevoTratamiento.diagnostico,
        notas: this.nuevoTratamiento.notas
      };

      this.isLoadingTratamiento = true;
      this.errorGuardando = '';
      this.cdr.detectChanges();

      this.tratamientosService.updateTratamiento(this.editandoTratamientoId, data).subscribe({
        next: (response: any) => {
          this.isLoadingTratamiento = false;
          if (response.success) {
            this.cargarTratamientos();
            this.cerrarModalTratamiento();
            this.showToast('Tratamiento actualizado correctamente', 'success');
          } else {
            this.errorGuardando = response.error || 'Error al actualizar';
            this.showToast(this.errorGuardando, 'error');
          }
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          this.isLoadingTratamiento = false;
          this.errorGuardando = this.obtenerMensajeError(error);
          this.showToast('Error al actualizar el tratamiento: ' + this.errorGuardando, 'error');
          this.cdr.detectChanges();
        }
      });
      return;
    }

    if (this.medicamentosTemp.length === 0) {
      this.errorGuardando = 'Debes agregar al menos un medicamento';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (this.esFechaPasada(this.nuevoTratamiento.fechaInicio)) {
      this.errorGuardando = 'La fecha de inicio no puede ser un dia que ya paso';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    for (const med of this.medicamentosTemp) {
      if (!med.nombre) {
        this.errorGuardando = 'Todos los medicamentos deben tener nombre';
        this.showToast(this.errorGuardando, 'warning');
        this.cdr.detectChanges();
        return;
      }
      if (!med.duracionDias || med.duracionDias < 1) {
        this.errorGuardando = 'Todos los medicamentos deben tener una duracion valida (minimo 1 dia)';
        this.showToast(this.errorGuardando, 'warning');
        this.cdr.detectChanges();
        return;
      }
    }

    const medicamentos = this.medicamentosTemp.map((med: any) => ({
      nombre: med.nombre,
      concentracion: med.concentracion || '',
      dosis: med.dosis || '',
      frecuencia: med.frecuencia,
      horaInicio: med.horaInicio,
      duracionDias: med.duracionDias,
      instrucciones: med.instrucciones || ''
    }));

    const data = {
      nombre: this.nuevoTratamiento.nombre,
      diagnostico: this.nuevoTratamiento.diagnostico,
      fechaInicio: this.nuevoTratamiento.fechaInicio,
      notas: this.nuevoTratamiento.notas,
      medicamentos: medicamentos
    };

    this.isLoadingTratamiento = true;
    this.errorGuardando = '';
    this.cdr.detectChanges();

    this.tratamientosService.createTratamiento(data).subscribe({
      next: (response: any) => {
        this.isLoadingTratamiento = false;
        if (response.success) {
          this.cargarTratamientos();
          this.cerrarModalTratamiento();
          this.showToast('Tratamiento guardado correctamente', 'success');
          if (response.data) {
            this.indexarTratamiento(response.data);
            if (response.data.medicamentos) {
              for (const med of response.data.medicamentos) {
                this.indexarMedicamento(med, response.data.id, response.data.nombre);
              }
            }
          }
        } else {
          this.errorGuardando = response.error || 'Error al guardar';
          this.showToast(this.errorGuardando, 'error');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoadingTratamiento = false;
        this.errorGuardando = this.obtenerMensajeError(error);
        this.showToast('Error al guardar el tratamiento: ' + this.errorGuardando, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalSuspenderTratamiento(tratamientoId: string) {
    this.errorGuardando = '';
    this.tratamientoSuspensionId = tratamientoId;
    this.datosSuspension.razon = '';
    this.mostrarModalSuspenderTratamiento = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModalSuspenderTratamiento() {
    this.mostrarModalSuspenderTratamiento = false;
    this.tratamientoSuspensionId = null;
    this.datosSuspension.razon = '';
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.cdr.detectChanges();
  }

  confirmarSuspenderTratamiento() {
    if (!this.tratamientoSuspensionId) return;
    
    if (!this.datosSuspension.razon.trim()) {
      this.errorGuardando = 'Debes ingresar una razon para suspender el tratamiento';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    this.isLoadingSuspension = true;
    this.errorGuardando = '';
    this.cdr.detectChanges();

    this.tratamientosService.desactivarTratamiento(this.tratamientoSuspensionId, this.datosSuspension.razon).subscribe({
      next: (response: any) => {
        this.isLoadingSuspension = false;
        if (response.success) {
          this.cargarTratamientos();
          this.cerrarModalSuspenderTratamiento();
          this.showToast('Tratamiento suspendido correctamente', 'success');
        } else {
          this.errorGuardando = response.error || 'Error al suspender';
          this.showToast(this.errorGuardando, 'error');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoadingSuspension = false;
        this.errorGuardando = this.obtenerMensajeError(error);
        this.showToast('Error al suspender el tratamiento: ' + this.errorGuardando, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  reactivarTratamiento(id: string) {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.tratamientosService.reactivarTratamiento(id).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.success) {
          this.cargarTratamientos();
          this.showToast('Tratamiento reactivado correctamente', 'success');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.showToast('Error al reactivar el tratamiento: ' + (this.obtenerMensajeError(error)), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  verHistorialTratamiento(tratamientoId: string) {
    const tratamiento = this.tratamientos.find((t: Tratamiento) => t.id === tratamientoId);
    if (!tratamiento) {
      this.showToast('Tratamiento no encontrado', 'error');
      return;
    }
    
    this.nombreMedicamentoHistorial = tratamiento.nombre + ' (Tratamiento)';
    this.historialMedicamento = tratamiento.historial_ajustes || [];
    this.mostrarModalHistorial = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  abrirModalMedicamento(tratamientoId: string) {
    this.errorGuardando = '';
    this.tratamientoIdActivo = tratamientoId;
    this.resetFormularioMedicamento();
    
    this.mostrarModalMedicamento = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  agregarMedicamentoATratamiento(tratamientoId: string) {
    this.abrirModalMedicamento(tratamientoId);
  }

  abrirModalAgregarMedicamentoGlobal() {
    const tratamientosEnCurso = this.getTratamientosEnCurso();
    if (tratamientosEnCurso.length === 0) {
      this.showToast('No hay tratamientos en progreso. Crea un tratamiento primero.', 'warning');
      return;
    }

    this.errorGuardando = '';
    this.tratamientoIdActivo = null;
    this.resetFormularioMedicamento();
    this.mostrarModalMedicamento = true;

    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModalMedicamento() {
    this.mostrarModalMedicamento = false;
    this.errorGuardando = '';
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.tratamientoIdActivo = null;
    this.resetFormularioMedicamento();
    this.cdr.detectChanges();
  }

  resetFormularioMedicamento() {
    this.nuevoMedicamentoSimple = {
      nombre: '',
      concentracion: '',
      dosis: '',
      frecuencia: 'Cada 8 horas',
      horaInicio: this.obtenerHoraActual(),
      duracionDias: 7,
      instrucciones: ''
    };
  }

  guardarMedicamentoEnTratamiento() {
    this.errorGuardando = '';

    if (!this.nuevoMedicamentoSimple.nombre) {
      this.errorGuardando = 'Ingresa el nombre del medicamento';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (!this.tratamientoIdActivo) {
      this.errorGuardando = 'Selecciona un tratamiento para agregar el medicamento';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (!this.nuevoMedicamentoSimple.duracionDias || this.nuevoMedicamentoSimple.duracionDias < 1) {
      this.errorGuardando = 'La duracion debe ser al menos 1 dia';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    const data = {
      nombre: this.nuevoMedicamentoSimple.nombre,
      concentracion: this.nuevoMedicamentoSimple.concentracion,
      dosis: this.nuevoMedicamentoSimple.dosis,
      frecuencia: this.nuevoMedicamentoSimple.frecuencia,
      horaInicio: this.nuevoMedicamentoSimple.horaInicio,
      duracionDias: this.nuevoMedicamentoSimple.duracionDias,
      instrucciones: this.nuevoMedicamentoSimple.instrucciones
    };

    this.isLoadingMedicamento = true;
    this.errorGuardando = '';
    this.cdr.detectChanges();

    this.tratamientosService.addMedicamento(this.tratamientoIdActivo, data).subscribe({
      next: (response: any) => {
        this.isLoadingMedicamento = false;
        if (response.success) {
          this.cargarTratamientos();
          this.cerrarModalMedicamento();
          this.showToast('Medicamento agregado al tratamiento', 'success');
          if (response.data) {
            const tratamiento = this.tratamientos.find(t => t.id === this.tratamientoIdActivo);
            this.indexarMedicamento(response.data, this.tratamientoIdActivo!, tratamiento?.nombre || '');
          }
        } else {
          this.errorGuardando = response.error || 'Error al agregar';
          this.showToast(this.errorGuardando, 'error');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoadingMedicamento = false;
        this.errorGuardando = this.obtenerMensajeError(error);
        this.showToast('Error al agregar el medicamento: ' + this.errorGuardando, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalEditarMedicamento(medicamento: Medicamento, tratamientoId: string) {
    if (medicamento.activo === false) {
      this.showToast('No se puede editar un medicamento suspendido. Reactivalo primero.', 'warning');
      return;
    }

    this.errorGuardando = '';
    this.medicamentoEditando = medicamento;
    this.medicamentoEditandoTratamientoId = tratamientoId;
    this.medicamentoEditandoData = {
      nombre: medicamento.nombre,
      concentracion: medicamento.concentracion || '',
      dosis: medicamento.dosis || '',
      frecuencia: medicamento.frecuencia,
      horaInicio: medicamento.hora_inicio,
      duracionDias: medicamento.duracion_dias,
      instrucciones: medicamento.instrucciones || ''
    };
    
    this.mostrarModalEditarMedicamento = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModalEditarMedicamento() {
    this.mostrarModalEditarMedicamento = false;
    this.errorGuardando = '';
    this.medicamentoEditando = null;
    this.medicamentoEditandoTratamientoId = null;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.cdr.detectChanges();
  }

  guardarEditarMedicamento() {
    this.errorGuardando = '';

    if (!this.medicamentoEditandoData.nombre) {
      this.errorGuardando = 'El nombre del medicamento es obligatorio';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (!this.medicamentoEditandoData.duracionDias || this.medicamentoEditandoData.duracionDias < 1) {
      this.errorGuardando = 'La duracion debe ser al menos 1 dia';
      this.showToast(this.errorGuardando, 'warning');
      this.cdr.detectChanges();
      return;
    }

    if (!this.medicamentoEditando) {
      this.errorGuardando = 'Medicamento no encontrado';
      this.showToast(this.errorGuardando, 'error');
      return;
    }

    const data = {
      nombre: this.medicamentoEditandoData.nombre,
      concentracion: this.medicamentoEditandoData.concentracion,
      dosis: this.medicamentoEditandoData.dosis,
      instrucciones: this.medicamentoEditandoData.instrucciones
    };

    this.isLoadingEditarMedicamento = true;
    this.errorGuardando = '';
    this.cdr.detectChanges();

    this.tratamientosService.updateMedicamento(this.medicamentoEditando.id!, data).subscribe({
      next: (response: any) => {
        this.isLoadingEditarMedicamento = false;
        if (response.success) {
          this.cargarTratamientos();
          this.cerrarModalEditarMedicamento();
          this.showToast('Medicamento actualizado correctamente', 'success');
          if (response.data) {
            const tratamiento = this.tratamientos.find(t => t.id === this.medicamentoEditandoTratamientoId);
            this.indexarMedicamento(response.data, this.medicamentoEditandoTratamientoId!, tratamiento?.nombre || '');
          }
        } else {
          this.errorGuardando = response.error || 'Error al actualizar';
          this.showToast(this.errorGuardando, 'error');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoadingEditarMedicamento = false;
        this.errorGuardando = this.obtenerMensajeError(error);
        this.showToast('Error al actualizar el medicamento: ' + this.errorGuardando, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalAjuste(medicamentoId: string, tipo: 'extender' | 'cambiar_frecuencia' | 'suspender') {
    const medicamento = this.tratamientos
      .flatMap((t: Tratamiento) => t.medicamentos || [])
      .find((m: Medicamento) => m.id === medicamentoId);
    
    if (!medicamento) {
      this.showToast('Medicamento no encontrado', 'error');
      return;
    }

    if (tipo !== 'suspender' && medicamento.activo === false) {
      this.showToast('No se puede ajustar un medicamento suspendido. Reactivalo primero.', 'warning');
      return;
    }

    if (tipo === 'suspender' && medicamento.activo === false) {
      this.showToast('El medicamento ya esta suspendido', 'warning');
      return;
    }

    this.medicamentoAjusteId = medicamentoId;
    this.tipoAjuste = tipo;
    this.datosAjuste = {
      diasExtra: 7,
      nuevaFrecuencia: medicamento.frecuencia || 'Cada 8 horas',
      razon: ''
    };
    this.mostrarModalAjuste = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  cerrarModalAjuste() {
    this.mostrarModalAjuste = false;
    this.medicamentoAjusteId = null;
    this.tipoAjuste = null;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.cdr.detectChanges();
  }

  guardarAjuste() {
    if (!this.medicamentoAjusteId || !this.tipoAjuste) return;
    
    if (!this.datosAjuste.razon.trim()) {
      this.showToast('Por favor, ingresa una razon medica para el ajuste', 'warning');
      return;
    }

    this.isLoadingAjuste = true;
    this.cdr.detectChanges();

    let observable: any;
    const mensajeExito: { [key: string]: string } = {
      extender: 'Duracion extendida correctamente',
      cambiar_frecuencia: 'Frecuencia cambiada correctamente',
      suspender: 'Medicamento suspendido correctamente'
    };

    switch (this.tipoAjuste) {
      case 'extender':
        if (this.datosAjuste.diasExtra < 1) {
          this.showToast('Los dias extra deben ser al menos 1', 'warning');
          this.isLoadingAjuste = false;
          return;
        }
        observable = this.tratamientosService.extenderMedicamento(
          this.medicamentoAjusteId,
          this.datosAjuste.diasExtra,
          this.datosAjuste.razon
        );
        break;
      case 'cambiar_frecuencia':
        observable = this.tratamientosService.cambiarFrecuenciaMedicamento(
          this.medicamentoAjusteId,
          this.datosAjuste.nuevaFrecuencia,
          this.datosAjuste.razon
        );
        break;
      case 'suspender':
        observable = this.tratamientosService.suspenderMedicamento(
          this.medicamentoAjusteId,
          this.datosAjuste.razon
        );
        break;
      default:
        this.isLoadingAjuste = false;
        return;
    }

    observable.subscribe({
      next: (response: any) => {
        this.isLoadingAjuste = false;
        if (response.success) {
          this.cargarTratamientos();
          this.cerrarModalAjuste();
          this.showToast(mensajeExito[this.tipoAjuste!] || 'Ajuste realizado', 'success');
        } else {
          this.showToast(response.error || 'Error al realizar el ajuste', 'error');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoadingAjuste = false;
        this.showToast('Error: ' + this.obtenerMensajeError(error), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  reactivarMedicamentoDesdeTemplate(medicamentoId: string) {
    this.isLoading = true;
    this.cdr.detectChanges();
    
    this.tratamientosService.reactivarMedicamento(medicamentoId).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        if (response.success) {
          this.cargarTratamientos();
          this.showToast('Medicamento reactivado correctamente', 'success');
        } else {
          this.showToast(response.error || 'Error al reactivar', 'error');
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoading = false;
        this.showToast('Error al reactivar: ' + this.obtenerMensajeError(error), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  verHistorial(medicamentoId: string, nombre: string) {
    this.nombreMedicamentoHistorial = nombre;
    this.isLoadingHistorial = true;
    this.cdr.detectChanges();
    
    this.tratamientosService.getHistorialMedicamento(medicamentoId).subscribe({
      next: (response: any) => {
        this.isLoadingHistorial = false;
        if (response.success) {
          this.historialMedicamento = response.data || [];
          this.mostrarModalHistorial = true;
          if (isPlatformBrowser(this.platformId)) {
            document.body.style.overflow = 'hidden';
          }
        }
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoadingHistorial = false;
        this.showToast('Error al cargar historial: ' + this.obtenerMensajeError(error), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  cerrarModalHistorial() {
    this.mostrarModalHistorial = false;
    this.historialMedicamento = [];
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.cdr.detectChanges();
  }

  private abrirConfirmacion(
    titulo: string,
    mensaje: string,
    accionConfirmar: () => void,
    opciones?: { textoConfirmar?: string; textoCancelar?: string; tipo?: 'danger' | 'default' }
  ) {
    this.confirmacion = {
      titulo,
      mensaje,
      textoConfirmar: opciones?.textoConfirmar || 'Eliminar',
      textoCancelar: opciones?.textoCancelar || 'Cancelar',
      tipo: opciones?.tipo || 'danger',
      accionConfirmar
    };
    this.mostrarModalConfirmacion = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.cdr.detectChanges();
  }

  confirmarAccion() {
    const accion = this.confirmacion.accionConfirmar;
    this.cerrarModalConfirmacion();
    if (accion) accion();
  }

  cerrarModalConfirmacion() {
    this.mostrarModalConfirmacion = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
    this.cdr.detectChanges();
  }

  marcarTomada(tratamientoId: string, medicamentoId: string, fecha: string, hora: string, completado: boolean) {
    if (completado) {
      this.showToast('Esta toma ya fue registrada como tomada', 'warning');
      return;
    }

    const horaProgramada = this.crearFechaHoraToma(fecha, hora);
    const horaLimite = new Date(horaProgramada.getTime() + TratamientosComponent.MARGEN_TOMA_MINUTOS * 60 * 1000);
    const ahora = new Date();

    if (ahora < horaProgramada) {
      this.showToast('Todavia no es hora de tomar esta dosis (' + this.formatearHora12(hora) + ')', 'warning');
      return;
    }
    if (ahora > horaLimite) {
      this.showToast('Ya paso el margen de 30 minutos para registrar esta toma (' + this.formatearHora12(hora) + ')', 'warning');
      return;
    }

    const data = { fecha, hora, completado: true };

    this.tratamientosService.marcarToma(medicamentoId, data).subscribe({
      next: (response: any) => {
        if (response.success) {
          const tratamiento = this.tratamientos.find((t: Tratamiento) => t.id === tratamientoId);
          if (tratamiento) {
            const medicamento = tratamiento.medicamentos?.find((m: Medicamento) => m.id === medicamentoId);
            if (medicamento && medicamento.tomas) {
              const toma = medicamento.tomas.find((t: TomaRealizada) => t.fecha === fecha && t.hora === hora);
              if (toma) {
                toma.completado = true;
              }
            }
          }
          this.showToast('Tomada correctamente a las ' + this.formatearHora12(hora), 'success');
          this.cdr.detectChanges();
        }
      },
      error: (error: any) => {
        this.showToast('Error al registrar la toma: ' + (this.obtenerMensajeError(error)), 'error');
        this.cargarTratamientos();
      }
    });
  }

  calcularProgresoTratamiento(tratamiento: Tratamiento): number {
    let totalTomas = 0;
    let tomasCompletadas = 0;
    for (const med of (tratamiento.medicamentos || [])) {
      const tomas = med.tomas || [];
      totalTomas += tomas.length;
      tomasCompletadas += tomas.filter((t: TomaRealizada) => t.completado).length;
    }
    return totalTomas === 0 ? 0 : Math.round((tomasCompletadas / totalTomas) * 100);
  }

  calcularProgresoMedicamento(medicamento: Medicamento): number {
    const tomas = medicamento.tomas || [];
    const total = tomas.length;
    if (total === 0) return 0;
    const completadas = tomas.filter((t: TomaRealizada) => t.completado).length;
    return Math.round((completadas / total) * 100);
  }

  getToday(): string {
    return this.formatearFechaLocal(new Date());
  }

  recargar() {
    this.cargarTratamientos();
    this.showToast('Tratamientos actualizados', 'info');
  }
}