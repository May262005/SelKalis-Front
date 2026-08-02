import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface ProximaToma {
  nombre: string;
  hora: string;
  medicamentoId?: string;
  tratamientoId?: string;
}

export interface ProximaCita {
  id: string;
  doctor: string;
  especialidad: string;
  fecha: string;
  hora: string;
  tipo: 'presencial' | 'virtual' | 'Presencial' | 'Virtual';
  lugar?: string;
}

export interface TratamientoActivo {
  id: string;
  nombre: string;
  medicamentosCount: number;
  progreso: number;
  estado: string;
}

export interface ProximoEstudio {
  id: string;
  lugar: string;
  tipo: string;
  fecha: string;
  hora: string;
}

export interface DocumentoReciente {
  id: string;
  nombre: string;
  tipo: 'pdf' | 'imagen' | 'archivo';
  fecha: string;
  tamano: string;
  url?: string;
  categoria?: string;
}

export interface DashboardData {
  proximaToma: ProximaToma | null;
  proximaCita: ProximaCita | null;
  tratamientosActivos: TratamientoActivo[];
  proximosEstudios: ProximoEstudio[];
  documentosRecientes: DocumentoReciente[];
  totalTratamientosActivos: number;
  tomasCompletadasHoy: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly TIMEOUT = 15000;

  private readonly TRATAMIENTOS_URL = 'https://selkalis-tratamientos-service.onrender.com';
  private readonly CITAS_URL = 'https://selkalis-citas-service.onrender.com';
  private readonly ESTUDIOS_URL = 'https://selkalis-estudios-service.onrender.com';
  private readonly DOCUMENTOS_URL = 'https://selkalis-documentos-service.onrender.com';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getFechaLocal(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getAuthHeaders(): HttpHeaders {
    let token = null;
    if (isPlatformBrowser(this.platformId)) {
      token = localStorage.getItem('sk_token');
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  getDashboardData(): Observable<DashboardData> {
    const headers = this.getAuthHeaders();

    const tratamientos$ = this.http.get(`${this.TRATAMIENTOS_URL}/tratamientos`, { headers })
      .pipe(
        timeout(this.TIMEOUT),
        catchError(() => of({ success: true, data: [] }))
      );

    const citas$ = this.http.get(`${this.CITAS_URL}/citas`, { headers })
      .pipe(
        timeout(this.TIMEOUT),
        catchError(() => of({ success: true, data: [] }))
      );

    const estudios$ = this.http.get(`${this.ESTUDIOS_URL}/estudios`, { headers })
      .pipe(
        timeout(this.TIMEOUT),
        catchError(() => of({ success: true, data: [] }))
      );

    const documentos$ = this.http.get(`${this.DOCUMENTOS_URL}/documentos`, { headers })
      .pipe(
        timeout(this.TIMEOUT),
        catchError(() => of({ success: true, data: [] }))
      );

    return forkJoin({
      tratamientos: tratamientos$,
      citas: citas$,
      estudios: estudios$,
      documentos: documentos$
    }).pipe(
      map((result: any) => {
        const tratamientos = result.tratamientos?.data || [];
        const citas = result.citas?.data || [];
        const estudios = result.estudios?.data || [];
        const documentos = result.documentos?.data || [];

        const hoyLocal = this.getFechaLocal();
        let tomasCompletadas = 0;

        for (const tratamiento of tratamientos) {
          if (tratamiento.estado !== 'activo' || tratamiento.activo === false) continue;
          const medicamentos = tratamiento.medicamentos || [];
          for (const med of medicamentos) {
            if (med.activo === false) continue;
            const tomas = med.tomas || [];
            const tomasHoy = tomas.filter((t: any) => t.fecha === hoyLocal);
            tomasCompletadas += tomasHoy.filter((t: any) => t.completado === true).length;
          }
        }

        const tratamientosActivos = this.obtenerTratamientosActivos(tratamientos);
        const totalTratamientosActivos = this.contarTratamientosActivos(tratamientos);

        return {
          proximaToma: this.obtenerProximaToma(tratamientos),
          proximaCita: this.obtenerProximaCita(citas),
          tratamientosActivos: tratamientosActivos,
          proximosEstudios: this.obtenerProximosEstudios(estudios),
          documentosRecientes: this.obtenerDocumentosRecientes(documentos),
          totalTratamientosActivos: totalTratamientosActivos,
          tomasCompletadasHoy: tomasCompletadas
        };
      }),
      catchError((error) => {
        return this.getDashboardDataFallback();
      })
    );
  }

  private getDashboardDataFallback(): Observable<DashboardData> {
    const headers = this.getAuthHeaders();

    const tratamientos$ = this.http.get(`${this.TRATAMIENTOS_URL}/tratamientos`, { headers })
      .pipe(timeout(this.TIMEOUT), catchError(() => of({ success: true, data: [] })));

    const citas$ = this.http.get(`${this.CITAS_URL}/citas`, { headers })
      .pipe(timeout(this.TIMEOUT), catchError(() => of({ success: true, data: [] })));

    const estudios$ = this.http.get(`${this.ESTUDIOS_URL}/estudios`, { headers })
      .pipe(timeout(this.TIMEOUT), catchError(() => of({ success: true, data: [] })));

    const documentos$ = this.http.get(`${this.DOCUMENTOS_URL}/documentos`, { headers })
      .pipe(timeout(this.TIMEOUT), catchError(() => of({ success: true, data: [] })));

    return forkJoin({
      tratamientos: tratamientos$,
      citas: citas$,
      estudios: estudios$,
      documentos: documentos$
    }).pipe(
      map((result: any) => {
        const tratamientos = result.tratamientos?.data || [];
        const citas = result.citas?.data || [];
        const estudios = result.estudios?.data || [];
        const documentos = result.documentos?.data || [];

        const hoyLocal = this.getFechaLocal();
        let tomasCompletadas = 0;

        for (const tratamiento of tratamientos) {
          if (tratamiento.estado !== 'activo' || tratamiento.activo === false) continue;
          const medicamentos = tratamiento.medicamentos || [];
          for (const med of medicamentos) {
            if (med.activo === false) continue;
            const tomas = med.tomas || [];
            const tomasHoy = tomas.filter((t: any) => t.fecha === hoyLocal);
            tomasCompletadas += tomasHoy.filter((t: any) => t.completado === true).length;
          }
        }

        return {
          proximaToma: this.obtenerProximaToma(tratamientos),
          proximaCita: this.obtenerProximaCita(citas),
          tratamientosActivos: this.obtenerTratamientosActivos(tratamientos),
          proximosEstudios: this.obtenerProximosEstudios(estudios),
          documentosRecientes: this.obtenerDocumentosRecientes(documentos),
          totalTratamientosActivos: this.contarTratamientosActivos(tratamientos),
          tomasCompletadasHoy: tomasCompletadas
        };
      }),
      catchError(this.handleError)
    );
  }

  private obtenerProximaToma(tratamientos: any[]): ProximaToma | null {
    if (!tratamientos || tratamientos.length === 0) return null;

    const ahora = new Date();
    const hoyLocal = this.getFechaLocal();

    for (const tratamiento of tratamientos) {
      if (tratamiento.estado !== 'activo' || tratamiento.activo === false) continue;

      const medicamentos = tratamiento.medicamentos || [];
      for (const med of medicamentos) {
        if (med.activo === false) continue;

        const tomas = med.tomas || [];

        const proximaToma = tomas
          .filter((t: any) => t.fecha === hoyLocal && !t.completado)
          .sort((a: any, b: any) => a.hora.localeCompare(b.hora))
          .find((t: any) => {
            const [h, m] = t.hora.split(':').map(Number);
            const horaToma = new Date();
            horaToma.setHours(h || 0, m || 0, 0, 0);
            return horaToma >= ahora;
          });

        if (proximaToma) {
          return {
            nombre: med.nombre,
            hora: this.formatearHora12(proximaToma.hora),
            medicamentoId: med.id,
            tratamientoId: tratamiento.id
          };
        }
      }
    }

    return null;
  }

  private obtenerProximaCita(citas: any[]): ProximaCita | null {
    if (!citas || citas.length === 0) return null;

    const hoyLocal = this.getFechaLocal();

    const proximas = citas
      .filter((c: any) => c.estado === 'pendiente')
      .filter((c: any) => c.fecha >= hoyLocal)
      .sort((a: any, b: any) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.hora.localeCompare(b.hora);
      });

    if (proximas.length === 0) return null;

    const cita = proximas[0];
    return {
      id: cita.id,
      doctor: cita.titulo || cita.doctor || 'Medico',
      especialidad: cita.especialidad || 'General',
      fecha: this.formatearFecha(cita.fecha),
      hora: this.formatearHora12(cita.hora),
      tipo: cita.tipo || 'presencial',
      lugar: cita.lugar
    };
  }

  private obtenerTratamientosActivos(tratamientos: any[]): TratamientoActivo[] {
    if (!tratamientos || tratamientos.length === 0) return [];

    const hoyLocal = this.getFechaLocal();

    return tratamientos
      .filter((t: any) => t.estado === 'activo' && t.activo !== false)
      .filter((t: any) => t.fecha_inicio <= hoyLocal && t.fecha_fin >= hoyLocal)
      .map((t: any) => ({
        id: t.id,
        nombre: t.nombre,
        medicamentosCount: (t.medicamentos || []).filter((m: any) => m.activo !== false).length,
        progreso: this.calcularProgresoTratamiento(t),
        estado: t.estado
      }))
      .slice(0, 5);
  }

  private obtenerProximosEstudios(estudios: any[]): ProximoEstudio[] {
    if (!estudios || estudios.length === 0) return [];

    const hoyLocal = this.getFechaLocal();

    return estudios
      .filter((e: any) => e.estado === 'pendiente')
      .filter((e: any) => e.fecha >= hoyLocal)
      .sort((a: any, b: any) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.hora.localeCompare(b.hora);
      })
      .map((e: any) => ({
        id: e.id,
        lugar: e.lugar || e.titulo || 'Laboratorio',
        tipo: e.tipo || 'Estudio',
        fecha: this.formatearFecha(e.fecha),
        hora: this.formatearHora12(e.hora)
      }))
      .slice(0, 3);
  }

  private obtenerDocumentosRecientes(documentos: any[]): DocumentoReciente[] {
    if (!documentos || documentos.length === 0) return [];

    return documentos
      .sort((a: any, b: any) => {
        const fechaA = new Date(a.created_at || a.fecha);
        const fechaB = new Date(b.created_at || b.fecha);
        return fechaB.getTime() - fechaA.getTime();
      })
      .map((d: any) => ({
        id: d.id,
        nombre: d.nombre,
        tipo: this.obtenerTipoDocumento(d.nombre, d.tipo),
        fecha: this.formatearFecha(d.created_at || d.fecha),
        tamano: d.tamano,
        url: d.url,
        categoria: d.categoria
      }))
      .slice(0, 3);
  }

  private contarTratamientosActivos(tratamientos: any[]): number {
    if (!tratamientos || tratamientos.length === 0) return 0;

    const hoyLocal = this.getFechaLocal();

    return tratamientos
      .filter((t: any) => t.estado === 'activo' && t.activo !== false)
      .filter((t: any) => t.fecha_inicio <= hoyLocal && t.fecha_fin >= hoyLocal)
      .length;
  }

  private calcularProgresoTratamiento(tratamiento: any): number {
    if (!tratamiento.medicamentos || tratamiento.medicamentos.length === 0) return 0;

    let totalTomas = 0;
    let completadas = 0;

    for (const med of tratamiento.medicamentos) {
      if (med.activo === false) continue;
      const tomas = med.tomas || [];
      totalTomas += tomas.length;
      completadas += tomas.filter((t: any) => t.completado).length;
    }

    return totalTomas === 0 ? 0 : Math.round((completadas / totalTomas) * 100);
  }

  private formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  private formatearHora12(hora24: string): string {
    if (!hora24) return '';
    const [h, m] = hora24.split(':').map(Number);
    const sufijo = h >= 12 ? 'PM' : 'AM';
    const hora12 = h % 12 || 12;
    return `${hora12}:${m.toString().padStart(2, '0')} ${sufijo}`;
  }

  private obtenerTipoDocumento(nombre: string, mimeType?: string): 'pdf' | 'imagen' | 'archivo' {
    if (mimeType) {
      if (mimeType === 'application/pdf') return 'pdf';
      if (mimeType.startsWith('image/')) return 'imagen';
    }
    if (nombre.endsWith('.pdf')) return 'pdf';
    if (nombre.endsWith('.png') || nombre.endsWith('.jpg') || nombre.endsWith('.jpeg') || nombre.endsWith('.webp')) return 'imagen';
    return 'archivo';
  }
}