import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class DispositivoService {
  private apiUrl = 'https://selkalis-auth-service.onrender.com';
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  private headers(): HttpHeaders {
    return this.authService.getAuthHeaders();
  }

  private wrap<T>(req: Observable<T>): Observable<T> {
    return req.pipe(
      timeout(90000),
      retry({ count: 1, delay: () => timer(2000) }),
      catchError((err) => throwError(() => err))
    );
  }

  obtenerEstado(userId: string): Observable<any> {
    return this.wrap(
      this.http.get(`${this.apiUrl}/usuarios/${userId}/dispositivo`, {
        headers: this.headers()
      })
    );
  }

  vincularTelefono(userId: string, telefono: string): Observable<any> {
    return this.wrap(
      this.http.post(
        `${this.apiUrl}/usuarios/${userId}/telefono`,
        { telefono },
        { headers: this.headers() }
      )
    );
  }

  asociarDispositivo(userId: string, device: {
    device_id: string;
    device_platform: string;
    device_model: string;
  }): Observable<any> {
    return this.wrap(
      this.http.post(
        `${this.apiUrl}/usuarios/${userId}/dispositivo`,
        device,
        { headers: this.headers() }
      )
    );
  }

  // ==================== HELPERS DEL NAVEGADOR ====================

  obtenerDeviceId(): string {
    if (!this.isBrowser) return 'unknown';
    const KEY = 'sk_device_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = 'web-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  detectarModelo(): string {
    if (!this.isBrowser) return 'unknown';
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) {
      const match = ua.match(/Android [\d.]+; ([^)]+)\)/);
      return match ? match[1] : 'Android';
    }
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac OS/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Navegador web';
  }

  detectarPlataforma(): 'android' | 'ios' | 'web' {
    if (!this.isBrowser) return 'web';
    const ua = navigator.userAgent;
    if (/Android/.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    return 'web';
  }
}