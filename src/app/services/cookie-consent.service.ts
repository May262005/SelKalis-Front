// cookie-consent.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface CookiePreferences {
  necesarias: boolean;
  preferencias: boolean;
  analiticas: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CookieConsentService {
  private consentSubject = new BehaviorSubject<CookiePreferences | null>(null);
  private showConfigSubject = new BehaviorSubject<boolean>(false);
  consent$ = this.consentSubject.asObservable();
  showConfig$ = this.showConfigSubject.asObservable();
  
  private readonly STORAGE_KEY = 'cookie_preferences';
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    if (this.isBrowser) {
      const saved = this.getPreferencias();
      if (saved) {
        this.consentSubject.next(saved);
      }
    }
  }

  guardarPreferencias(prefs: CookiePreferences): void {
    if (!this.isBrowser) return;
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prefs));
    this.setCookie('cookie_preferences', JSON.stringify(prefs), 365);
    this.consentSubject.next(prefs);
    this.showConfigSubject.next(false);
  }

  getPreferencias(): CookiePreferences | null {
    if (!this.isBrowser) return null;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  setCookie(name: string, value: string, days: number): void {
    if (!this.isBrowser) return;
    
    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    } catch {
      // Error silencioso
    }
  }

  private getCookie(name: string): string | null {
    if (!this.isBrowser) return null;
    
    try {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
      return null;
    } catch {
      return null;
    }
  }

  deleteCookie(name: string): void {
    if (!this.isBrowser) return;
    
    try {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    } catch {
      // Error silencioso
    }
  }

  eliminarConsentimiento(): void {
    if (!this.isBrowser) return;
    
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.deleteCookie('cookie_preferences');
      this.consentSubject.next(null);
      this.showConfigSubject.next(false);
    } catch {
      // Error silencioso
    }
  }

  obtenerPreferenciasActuales(): CookiePreferences | null {
    return this.getPreferencias();
  }

  abrirConfiguracion(): void {
    if (!this.isBrowser) return;
    
    this.showConfigSubject.next(true);
    
    const currentPrefs = this.getPreferencias();
    
    if (currentPrefs) {
      this.consentSubject.next(currentPrefs);
    } else {
      const defaultPrefs: CookiePreferences = {
        necesarias: true,
        preferencias: false,
        analiticas: false
      };
      this.consentSubject.next(defaultPrefs);
    }
  }

  cerrarConfiguracion(): void {
    if (!this.isBrowser) return;
    this.showConfigSubject.next(false);
  }
}