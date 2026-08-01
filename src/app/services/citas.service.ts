// citas.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface Cita {
  id?: string;
  titulo: string;
  especialidad: string;
  fecha: string;
  hora: string;
  tipo: 'Presencial' | 'Virtual';
  lugar?: string;
  notas?: string;
  estado: 'pendiente' | 'completada' | 'cancelada';
  recordatorio?: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class CitasService {
  private apiUrl = 'https://selkalis-citas-service.onrender.com';

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

  getCitas(): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCita(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createCita(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/citas`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateCita(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/citas/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  cambiarEstadoCita(id: string, estado: 'pendiente' | 'completada' | 'cancelada'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/citas/${id}/estado`, { estado }, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  eliminarCita(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/citas/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCitasPorMes(mes: number, anio: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/citas/mes/${mes}/${anio}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }
}