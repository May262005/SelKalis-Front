// services/admin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  rol: 'admin' | 'user';
  activo: boolean;
  created_at: string;
  ultimo_login: string | null;
}

export interface UsuarioResponse {
  success: boolean;
  data: Usuario[];
}

export interface UsuarioSingleResponse {
  success: boolean;
  data: Usuario;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

const SK_TOKEN = 'sk_token';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  // Mismo backend que auth.service.ts
  private apiUrl = 'https://selkalis-auth-service.onrender.com';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem(SK_TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Obtener todos los usuarios
  getUsuarios(): Observable<Usuario[]> {
    return this.http.get<UsuarioResponse>(`${this.apiUrl}/admin/usuarios`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Obtener usuario por ID
  getUsuarioById(id: string): Observable<Usuario> {
    return this.http.get<UsuarioSingleResponse>(`${this.apiUrl}/admin/usuarios/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Crear usuario (admin)
  crearUsuario(usuario: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    password: string;
    rol?: 'admin' | 'user';
  }): Observable<Usuario> {
    return this.http.post<UsuarioSingleResponse>(`${this.apiUrl}/admin/usuarios`, usuario, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Actualizar usuario
  actualizarUsuario(id: string, data: Partial<Usuario>): Observable<Usuario> {
    return this.http.put<UsuarioSingleResponse>(`${this.apiUrl}/admin/usuarios/${id}`, data, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // Suspender usuario
  suspenderUsuario(id: string): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/admin/usuarios/${id}/suspender`, {}, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Activar usuario
  activarUsuario(id: string): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/admin/usuarios/${id}/activar`, {}, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Eliminar usuario
  eliminarUsuario(id: string): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/admin/usuarios/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // Manejo de errores
  private handleError(error: any): Observable<never> {
    let errorMessage = 'Ocurrió un error en la operación';

    if (error.error) {
      errorMessage = error.error.error || error.error.message || errorMessage;
    }

    console.error('Error en AdminService:', error);
    return throwError(() => new Error(errorMessage));
  }
}