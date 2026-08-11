// services/search.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, timeout, map } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

export interface SearchResult {
  id: string;
  tipo: 'cita' | 'tratamiento' | 'medicamento' | 'estudio' | 'documento';
  titulo: string;
  descripcion: string;
  fecha?: string;
  estado?: string;
  relevancia?: number;
  datos?: any;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  // ✅ Subido de 10s a 15s: el servicio en Render puede tardar en "despertar" (cold start)
  // en el plan gratuito, y con 10s muchas peticiones de indexado truenan sin necesidad.
  private readonly TIMEOUT = 15000;
  private readonly SEARCH_URL = 'https://sselkalis-search-service.onrender.com';

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

  // ✅ Logging detallado: permite distinguir en consola entre timeout, error de CORS,
  // error 4xx/5xx del backend, o token inválido/expirado, en vez de un "Error" genérico.
  private logError(contexto: string, error: any): void {
    if (error instanceof HttpErrorResponse) {
      console.error(`❌ ${contexto}:`, {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        url: error.url,
        errorBody: error.error
      });
    } else {
      console.error(`❌ ${contexto}:`, {
        name: error?.name,
        message: error?.message
      });
    }
  }

  /**
   * Buscar en un módulo específico
   */
  buscarModulo(modulo: string, termino: string, filtros?: any): Observable<any> {
    if (!termino || termino.trim().length < 2) {
      return of({ success: true, data: { total: 0, resultados: [] } });
    }

    const headers = this.getAuthHeaders();
    return this.http.post(`${this.SEARCH_URL}/search/modulo`,
      { modulo, termino: termino.trim(), filtros: filtros || {} },
      { headers }
    ).pipe(
      timeout(this.TIMEOUT),
      catchError((error) => {
        this.logError(`Error buscando en ${modulo}`, error);
        return of({ success: true, data: { total: 0, resultados: [] } });
      })
    );
  }

  /**
   * Búsqueda global
   */
  buscarGlobal(termino: string, limite: number = 20): Observable<any> {
    if (!termino || termino.trim().length < 2) {
      return of({ success: true, data: { total: 0, resultados: [] } });
    }

    const headers = this.getAuthHeaders();
    return this.http.post(`${this.SEARCH_URL}/search/global`,
      { termino: termino.trim(), limite },
      { headers }
    ).pipe(
      timeout(this.TIMEOUT),
      catchError((error) => {
        this.logError('Error en búsqueda global', error);
        return of({ success: true, data: { total: 0, resultados: [] } });
      })
    );
  }

  /**
   * Indexar documento
   */
  indexar(modulo: string, documento: any): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.post(`${this.SEARCH_URL}/search/indexar`,
      { modulo, documento },
      { headers }
    ).pipe(
      timeout(this.TIMEOUT),
      catchError((error) => {
        this.logError(`Error indexando en ${modulo} (doc id: ${documento?.id})`, error);
        return of({ success: false, error: error.message });
      })
    );
  }

  /**
   * Eliminar documento
   */
  eliminar(modulo: string, id: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete(`${this.SEARCH_URL}/search/${modulo}/${id}`, { headers })
      .pipe(
        timeout(this.TIMEOUT),
        catchError((error) => {
          this.logError(`Error eliminando de ${modulo}`, error);
          return of({ success: false, error: error.message });
        })
      );
  }
}