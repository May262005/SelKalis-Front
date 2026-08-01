// documentos.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, timeout, TimeoutError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface Documento {
  id: string;
  nombre: string;
  tipo: string;
  tamano: string;
  fecha: string;
  url: string;
  categoria: 'receta' | 'estudio' | 'informe' | 'otro';
  descripcion?: string;
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private apiUrl = 'https://selkalis-documentos-service.onrender.com';
  private readonly REQUEST_TIMEOUT = 30000;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private getAuthHeaders(): HttpHeaders {
    let token = null;
    if (isPlatformBrowser(this.platformId)) {
      token = localStorage.getItem('sk_token');
    }

    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error en el servidor';
    
    if (error instanceof TimeoutError) {
      errorMessage = 'La solicitud tardo demasiado. Intenta de nuevo.';
    } else if (error.error?.error) {
      errorMessage = error.error.error;
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return throwError(() => ({ ...error, userMessage: errorMessage }));
  }

  getDocumentos(categoria?: string): Observable<any> {
    let url = `${this.apiUrl}/documentos`;
    if (categoria && categoria !== 'todos') {
      url += `?categoria=${categoria}`;
    }
    return this.http.get(url, {
      headers: this.getAuthHeaders()
    }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(this.handleError)
    );
  }

  getDocumento(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/documentos/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(this.handleError)
    );
  }

  subirDocumento(file: File, nombre: string, categoria: string, descripcion?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nombre', nombre);
    formData.append('categoria', categoria);
    if (descripcion) {
      formData.append('descripcion', descripcion);
    }

    let token = null;
    if (isPlatformBrowser(this.platformId)) {
      token = localStorage.getItem('sk_token');
    }

    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return this.http.post(`${this.apiUrl}/documentos/upload`, formData, {
      headers: headers
    }).pipe(
      timeout(60000),
      catchError(this.handleError)
    );
  }

  descargarDocumento(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/documentos/${id}/descargar`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(this.handleError)
    );
  }

  eliminarDocumento(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/documentos/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      timeout(this.REQUEST_TIMEOUT),
      catchError(this.handleError)
    );
  }

  getUrlDescarga(id: string): string {
    return `${this.apiUrl}/documentos/${id}/descargar`;
  }
}