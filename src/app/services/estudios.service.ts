// estudios.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface Estudio {
  id?: string;
  titulo: string;
  tipo: string;
  fecha: string;
  hora: string;
  lugar?: string;
  notas?: string;
  estado: 'pendiente' | 'completado' | 'cancelado' | 'programado';
  prioridad?: 'baja' | 'normal' | 'alta' | 'urgente';
  recordatorio?: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class EstudiosService {
  private apiUrl = 'https://selkalis-estudios-service.onrender.com';

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

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

  getEstudios(): Observable<any> {
    return this.http.get(`${this.apiUrl}/estudios`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getEstudio(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/estudios/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createEstudio(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/estudios`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateEstudio(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/estudios/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  cambiarEstado(id: string, estado: 'pendiente' | 'completado' | 'cancelado' | 'programado'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/estudios/${id}/estado`, { estado }, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getEstudiosPorFecha(fecha: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/estudios/fecha/${fecha}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getEstudiosPorTipo(tipo: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/estudios/tipo/${tipo}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }
}