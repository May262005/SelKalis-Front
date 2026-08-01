// tratamientos.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface TomaRealizada {
  fecha: string;
  hora: string;
  completado: boolean;
}

export interface HistorialAjuste {
  fecha: string;
  tipo: 'extender' | 'cambiar_frecuencia' | 'suspender' | 'reactivar' | 'actualizar_datos';
  razon: string;
  diasExtra?: number;
  nuevaDuracion?: number;
  frecuenciaAnterior?: string;
  frecuenciaNueva?: string;
}

export interface Medicamento {
  id?: string;
  nombre: string;
  concentracion: string;
  dosis: string;
  frecuencia: string;
  hora_inicio: string;
  duracion_dias: number;
  instrucciones?: string;
  created_at?: string;
  activo?: boolean;
  tomas?: TomaRealizada[];
  horariosCalculados?: string[];
  historial_ajustes?: HistorialAjuste[];
  fecha_suspension?: string;
  ultimo_ajuste?: string;
}

export interface Tratamiento {
  id?: string;
  nombre: string;
  diagnostico?: string;
  fecha_inicio: string;
  fecha_fin: string;
  notas?: string;
  estado: 'activo' | 'completado';
  created_at?: string;
  updated_at?: string;
  activo?: boolean;
  medicamentos?: Medicamento[];
  historial_ajustes?: HistorialAjuste[];
  ultimo_ajuste?: string;
}

@Injectable({ providedIn: 'root' })
export class TratamientosService {
  private apiUrl = 'https://selkalis-tratamientos-service.onrender.com';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private obtenerZonaHoraria(): string {
    if (!isPlatformBrowser(this.platformId)) return 'UTC';
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private getAuthHeaders(): HttpHeaders {
    let token = null;
    if (isPlatformBrowser(this.platformId)) {
      token = localStorage.getItem('sk_token');
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Timezone': this.obtenerZonaHoraria()
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  getTratamientos(): Observable<any> {
    return this.http.get(`${this.apiUrl}/tratamientos`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getTratamiento(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/tratamientos/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createTratamiento(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/tratamientos`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateTratamiento(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/tratamientos/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  desactivarTratamiento(id: string, razon?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/tratamientos/${id}/estado`, 
      { activo: false, razon }, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  reactivarTratamiento(id: string, razon?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/tratamientos/${id}/estado`, 
      { activo: true, razon }, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  addMedicamento(tratamientoId: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/tratamientos/${tratamientoId}/medicamentos`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateMedicamento(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/medicamentos/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  extenderMedicamento(id: string, diasExtra: number, razon?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/medicamentos/${id}/extender`, 
      { diasExtra, razon }, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  cambiarFrecuenciaMedicamento(id: string, nuevaFrecuencia: string, razon?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/medicamentos/${id}/cambiar-frecuencia`, 
      { nuevaFrecuencia, razon }, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  suspenderMedicamento(id: string, razon?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/medicamentos/${id}/suspender`, 
      { razon }, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  reactivarMedicamento(id: string, razon?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/medicamentos/${id}/reactivar`, 
      { razon }, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getHistorialMedicamento(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/medicamentos/${id}/historial`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  marcarToma(medicamentoId: string, data: { fecha: string; hora: string; completado: boolean }): Observable<any> {
    return this.http.post(`${this.apiUrl}/medicamentos/${medicamentoId}/tomas`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getTomas(medicamentoId: string, fecha: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/medicamentos/${medicamentoId}/tomas/${fecha}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }
}