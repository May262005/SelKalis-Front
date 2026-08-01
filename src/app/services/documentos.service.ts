import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
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
    let userMessage = 'Ocurrio un error. Intenta de nuevo.';

    if (error.error?.error) {
      // Mensaje amable que ya viene del backend
      userMessage = error.error.error;
    } else if (error.error?.message) {
      userMessage = error.error.message;
    } else if (error.status === 0) {
      // Sin conexion al servidor, CORS, o servidor caido
      userMessage = 'No hay conexion con el servidor. Verifica tu internet.';
    } else if (error.status === 401) {
      userMessage = 'Tu sesion expiro. Inicia sesion de nuevo.';
    } else if (error.status === 403) {
      userMessage = 'No tienes permiso para hacer esto.';
    } else if (error.status === 404) {
      userMessage = 'No encontramos lo que buscas.';
    } else if (error.status === 413) {
      userMessage = 'El archivo es demasiado pesado. El limite es 50 MB.';
    } else if (error.status >= 500) {
      userMessage = 'Hubo un problema en el servidor. Intenta de nuevo en un momento.';
    } else if (error.message) {
      if (error.message.includes('timeout')) {
        userMessage = 'La conexion esta tardando demasiado. Verifica tu internet.';
      } else if (error.message.includes('Network')) {
        userMessage = 'No hay conexion con el servidor. Verifica tu internet.';
      }
    }

    console.error('Error del servicio:', { error, userMessage });

    return throwError(() => ({
      ...error,
      userMessage: userMessage
    }));
  }

  getDocumentos(categoria?: string): Observable<any> {
    let url = `${this.apiUrl}/documentos`;
    if (categoria && categoria !== 'todos') {
      url += `?categoria=${categoria}`;
    }
    return this.http.get(url, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getDocumento(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/documentos/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
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
    // No establecer Content-Type, el navegador lo hace automaticamente con FormData

    return this.http.post(`${this.apiUrl}/documentos/upload`, formData, {
      headers: headers
    }).pipe(
      catchError(this.handleError)
    );
  }

  descargarDocumento(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/documentos/${id}/descargar`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  eliminarDocumento(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/documentos/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  getUrlDescarga(id: string): string {
    return `${this.apiUrl}/documentos/${id}/descargar`;
  }
}