import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { tap, catchError, retry, timeout } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';

interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  created_at?: string;
  ultimo_login?: string;
}

const SK_TOKEN = 'sk_token';
const SK_CREDENTIALS = 'sk_credentials';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // ✅ URL CORRECTA del backend en Render
  private apiUrl = 'https://selkalis-auth-service.onrender.com';
  
  private readonly REQUEST_TIMEOUT = 60000;
  private readonly RETRY_DELAY = 2000;
  private readonly MAX_RETRIES = 2;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isBrowser: boolean;

  private tokenReadySubject = new BehaviorSubject<boolean>(false);
  public tokenReady$ = this.tokenReadySubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.limpiarLegacy();
      this.cargarSesion();
      setTimeout(() => {
        this.tokenReadySubject.next(true);
      }, 100);
    }
  }

  private limpiarLegacy() {
    ['auth_token', 'user_data', 'selkalis_token',
     'selkalis_remember_token', 'selkalis_saved_email',
     'selkalis_remember_me', 'selkalis_saved_password',
     'sk_remember_temp', 'sk_user_id', 'sk_remember_email',
     'sk_email', 'sk_last_email', 'sk_remember', 'sk_remember_tk'].forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  }

  private cargarSesion() {
    const token = localStorage.getItem(SK_TOKEN);
    
    if (!token) {
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const nowSec = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < nowSec) {
        this.clearAllStorage();
        return;
      }

      this.currentUserSubject.next({
        id: payload.id,
        nombre: payload.nombre,
        apellido: payload.apellido,
        email: payload.email
      });
    } catch {
      this.clearAllStorage();
    }
  }

  private clearAllStorage(): void {
    localStorage.removeItem(SK_TOKEN);
    this.currentUserSubject.next(null);
    this.tokenReadySubject.next(false);
  }

  guardarCredenciales(email: string, password: string): void {
    if (!this.isBrowser) return;
    const encrypted = btoa(JSON.stringify({ email, password }));
    localStorage.setItem(SK_CREDENTIALS, encrypted);
  }

  obtenerCredenciales(): { email: string; password: string } | null {
    if (!this.isBrowser) return null;
    const stored = localStorage.getItem(SK_CREDENTIALS);
    if (!stored) return null;
    try {
      const decrypted = JSON.parse(atob(stored));
      return decrypted;
    } catch {
      return null;
    }
  }

  eliminarCredenciales(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(SK_CREDENTIALS);
  }

  tieneCredencialesGuardadas(): boolean {
    if (!this.isBrowser) return false;
    return !!localStorage.getItem(SK_CREDENTIALS);
  }

  private requestWithRetry<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      timeout(this.REQUEST_TIMEOUT),
      retry({
        count: this.MAX_RETRIES,
        delay: (error, retryCount) => {
          if (error instanceof HttpErrorResponse && error.status === 502) {
            return timer(3000);
          }
          return timer(this.RETRY_DELAY);
        }
      }),
      catchError(this.handleError.bind(this))
    );
  }

  // ==================== MÉTODOS DE AUTENTICACIÓN ====================

  register(userData: any): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/usuarios/registro`, userData)
    );
  }

  login(email: string, password: string, rememberMe: boolean = false): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/usuarios/login`, { email, password })
    ).pipe(
      tap((response: any) => {
        if (!this.isBrowser || !response.token) return;
        localStorage.setItem(SK_TOKEN, response.token);
        if (response.user) {
          this.currentUserSubject.next(response.user);
        }
        this.tokenReadySubject.next(true);
        
        if (rememberMe) {
          this.guardarCredenciales(email, password);
        } else {
          this.eliminarCredenciales();
        }
      })
    );
  }

  logout() {
    if (!this.isBrowser) return;

    const token = localStorage.getItem(SK_TOKEN);

    if (token) {
      this.http.post(
        `${this.apiUrl}/usuarios/logout`,
        {},
        { headers: this.getAuthHeaders() }
      ).pipe(
        timeout(5000),
        catchError(() => {
          return [];
        })
      ).subscribe();
    }

    this.clearAllStorage();
    this.tokenReadySubject.next(false);
    this.router.navigate(['/login']);
  }

  // ==================== RECUPERACIÓN DE CONTRASEÑA ====================

  solicitarRecuperacion(email: string): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/auth/recuperar`, { email })
    );
  }

  verificarCodigo(email: string, codigo: string): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/auth/verificar-codigo`, { email, codigo })
    );
  }

  cambiarPasswordRecuperacion(email: string, token: string, nuevaPassword: string): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/auth/cambiar-password`, { email, token, nuevaPassword })
    );
  }

  reenviarCodigo(email: string): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/auth/reenviar-codigo`, { email })
    );
  }

  // ==================== MÉTODOS DE USUARIO ====================

  getUsuario(id: string): Observable<any> {
    return this.requestWithRetry(
      this.http.get(`${this.apiUrl}/usuarios/${id}`, { headers: this.getAuthHeaders() })
    );
  }

  actualizarUsuario(id: string, data: any): Observable<any> {
    return this.requestWithRetry(
      this.http.put(`${this.apiUrl}/usuarios/${id}`, data, { headers: this.getAuthHeaders() })
    );
  }

  cambiarPassword(userId: string, currentPassword: string, newPassword: string): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/usuarios/cambiar-password`,
        { userId, currentPassword, newPassword },
        { headers: this.getAuthHeaders() }
      )
    );
  }

  // ==================== MÉTODOS DE UTILIDAD ====================

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(SK_TOKEN);
  }

  isLoggedIn(): boolean {
    if (!this.isBrowser) return false;
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
  }

  // ==================== MANEJO DE ERRORES ====================

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error en la conexión';
    
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 0:
          errorMessage = 'No se pudo conectar al servidor. Verifica tu conexión.';
          break;
        case 400:
          errorMessage = error.error?.error || error.error?.mensaje || 'Solicitud incorrecta';
          break;
        case 401:
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
          break;
        case 404:
          errorMessage = 'Endpoint no encontrado. Verifica la URL.';
          break;
        case 502:
          errorMessage = 'El servicio está despertando. Intenta de nuevo en unos segundos.';
          break;
        case 503:
          errorMessage = 'El servicio no está disponible. Intenta más tarde.';
          break;
        default:
          errorMessage = error.error?.error || error.error?.mensaje || 'Error en el servidor';
      }
    }

    const enrichedError = {
      ...error,
      userMessage: errorMessage,
      status: error.status || 0
    };

    return throwError(() => enrichedError);
  }
}