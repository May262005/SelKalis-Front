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
const SK_USER_DATA = 'sk_user_data';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // URL del backend en Render
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

  // ==================== LIMPIEZA DE DATOS LEGACY ====================
  
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

  // ==================== CARGA DE SESIÓN ====================
  
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

      // Intentar cargar datos completos del usuario desde almacenamiento local
      const storedUser = localStorage.getItem(SK_USER_DATA);
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          this.currentUserSubject.next({
            id: payload.id || userData.id,
            nombre: payload.nombre || userData.nombre,
            apellido: payload.apellido || userData.apellido,
            email: payload.email || userData.email,
            telefono: userData.telefono || '',
            created_at: userData.created_at || '',
            ultimo_login: userData.ultimo_login || ''
          });
          return;
        } catch (error) {
          console.warn('Error al cargar datos de usuario almacenados:', error);
        }
      }

      // Si no hay datos almacenados, usar solo el payload del token
      this.currentUserSubject.next({
        id: payload.id,
        nombre: payload.nombre,
        apellido: payload.apellido || '',
        email: payload.email,
        telefono: payload.telefono || '',
        created_at: payload.created_at || '',
        ultimo_login: payload.ultimo_login || ''
      });
    } catch (error) {
      console.error('Error al cargar sesión:', error);
      this.clearAllStorage();
    }
  }

  private clearAllStorage(): void {
    localStorage.removeItem(SK_TOKEN);
    localStorage.removeItem(SK_USER_DATA);
    this.currentUserSubject.next(null);
    this.tokenReadySubject.next(false);
  }

  // ==================== CREDENCIALES GUARDADAS ====================
  
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

  // ==================== CONFIGURACIÓN DE PETICIONES ====================
  
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

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
  }

  // ==================== MÉTODOS DE AUTENTICACIÓN ====================

  register(userData: any): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/usuarios/registro`, userData)
    ).pipe(
      tap((response: any) => {
        console.log('✅ Registro exitoso:', response);
        if (response.token && response.usuario) {
          this.handleSuccessfulLogin(response.token, response.usuario);
        }
      })
    );
  }

  login(email: string, password: string, rememberMe: boolean = false): Observable<any> {
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/usuarios/login`, { email, password })
    ).pipe(
      tap((response: any) => {
        console.log('✅ Login exitoso:', response);
        if (response.token && response.user) {
          this.handleSuccessfulLogin(response.token, response.user);
          
          if (rememberMe) {
            this.guardarCredenciales(email, password);
          } else {
            this.eliminarCredenciales();
          }
        }
      })
    );
  }

  private handleSuccessfulLogin(token: string, user: any): void {
    if (!this.isBrowser) return;
    
    // Guardar token
    localStorage.setItem(SK_TOKEN, token);
    
    // Guardar datos completos del usuario
    const userData = {
      id: user.id,
      nombre: user.nombre || '',
      apellido: user.apellido || '',
      email: user.email || '',
      telefono: user.telefono || '',
      created_at: user.created_at || '',
      ultimo_login: user.ultimo_login || ''
    };
    
    localStorage.setItem(SK_USER_DATA, JSON.stringify(userData));
    
    // Actualizar el BehaviorSubject
    this.currentUserSubject.next(userData);
    this.tokenReadySubject.next(true);
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
      ).subscribe({
        next: () => console.log('✅ Logout exitoso'),
        error: () => console.warn('⚠️ Error en logout, limpiando sesión localmente')
      });
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
    console.log(`🔍 Obteniendo usuario ${id} desde ${this.apiUrl}/usuarios/${id}`);
    return this.requestWithRetry(
      this.http.get(`${this.apiUrl}/usuarios/${id}`, { headers: this.getAuthHeaders() })
    ).pipe(
      tap((response: any) => {
        console.log('📥 Datos completos del usuario:', response);
        if (response && response.user) {
          // Actualizar los datos del usuario en el almacenamiento local
          const currentUser = this.currentUserSubject.value;
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              ...response.user
            };
            this.updateUserData(updatedUser);
          }
        }
      })
    );
  }

  actualizarUsuario(id: string, data: any): Observable<any> {
    console.log(`✏️ Actualizando usuario ${id} con:`, data);
    return this.requestWithRetry(
      this.http.put(`${this.apiUrl}/usuarios/${id}`, data, { headers: this.getAuthHeaders() })
    ).pipe(
      tap((response: any) => {
        console.log('✅ Usuario actualizado:', response);
        if (response && response.user) {
          // Actualizar los datos del usuario en el almacenamiento local
          const currentUser = this.currentUserSubject.value;
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              ...response.user
            };
            this.updateUserData(updatedUser);
          }
        }
      })
    );
  }

  cambiarPassword(userId: string, currentPassword: string, newPassword: string): Observable<any> {
    console.log(`🔑 Cambiando contraseña para usuario ${userId}`);
    return this.requestWithRetry(
      this.http.post(`${this.apiUrl}/usuarios/cambiar-password`,
        { userId, currentPassword, newPassword },
        { headers: this.getAuthHeaders() }
      )
    );
  }

  // ==================== ACTUALIZACIÓN DE DATOS DEL USUARIO ====================

  /**
   * Actualiza los datos del usuario en el BehaviorSubject y en localStorage
   */
  updateUserData(userData: Partial<User>): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      const updatedUser = { ...currentUser, ...userData };
      this.currentUserSubject.next(updatedUser);
      
      // Guardar en localStorage
      if (this.isBrowser) {
        localStorage.setItem(SK_USER_DATA, JSON.stringify(updatedUser));
      }
      
      console.log('🔄 Datos de usuario actualizados:', updatedUser);
    } else {
      // Si no hay usuario actual, crear uno nuevo
      if (this.isBrowser) {
        localStorage.setItem(SK_USER_DATA, JSON.stringify(userData));
        this.currentUserSubject.next(userData as User);
      }
    }
  }

  /**
   * Obtiene los datos completos del usuario actual
   */
  getUserData(): User | null {
    const user = this.currentUserSubject.value;
    if (user) return user;
    
    // Intentar recuperar del localStorage
    if (this.isBrowser) {
      const stored = localStorage.getItem(SK_USER_DATA);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Obtiene solo el ID del usuario actual
   */
  getUserId(): string | null {
    const user = this.getUserData();
    return user ? user.id : null;
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

  /**
   * Verifica si el token es válido
   */
  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const nowSec = Math.floor(Date.now() / 1000);
      return payload.exp && payload.exp > nowSec;
    } catch {
      return false;
    }
  }

  /**
   * Refresca los datos del usuario desde el servidor
   */
  refreshUserData(): Observable<any> {
    const userId = this.getUserId();
    if (!userId) {
      return throwError(() => new Error('No hay usuario autenticado'));
    }
    return this.getUsuario(userId);
  }

  // ==================== MANEJO DE ERRORES ====================

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error en la conexión';
    let statusCode = 0;
    
    if (error instanceof HttpErrorResponse) {
      statusCode = error.status;
      
      switch (error.status) {
        case 0:
          errorMessage = 'No se pudo conectar al servidor. Verifica tu conexión.';
          break;
        case 400:
          errorMessage = error.error?.error || error.error?.mensaje || 'Solicitud incorrecta';
          break;
        case 401:
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
          // Limpiar sesión si el token expiró
          if (this.isBrowser) {
            this.clearAllStorage();
            this.tokenReadySubject.next(false);
          }
          break;
        case 403:
          errorMessage = 'No tienes permiso para realizar esta acción';
          break;
        case 404:
          errorMessage = error.error?.error || 'Recurso no encontrado';
          break;
        case 409:
          errorMessage = error.error?.error || 'Conflicto con los datos existentes';
          break;
        case 422:
          errorMessage = error.error?.error || 'Datos inválidos';
          break;
        case 500:
          errorMessage = 'Error interno del servidor. Intenta más tarde.';
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
      
      console.error(`❌ Error ${error.status}:`, errorMessage);
    } else {
      console.error('❌ Error desconocido:', error);
    }

    const enrichedError = {
      ...error,
      userMessage: errorMessage,
      status: statusCode || error.status || 0,
      originalError: error
    };

    return throwError(() => enrichedError);
  }
}