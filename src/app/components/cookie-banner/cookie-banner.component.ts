// cookie-banner.component.ts
import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CookieConsentService, CookiePreferences } from '../../services/cookie-consent.service';
import { Subscription } from 'rxjs';

declare var gtag: any;

declare global {
  interface Window {
    gaInitialized?: boolean;
    dataLayer?: any[];
  }
}

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cookie-banner.component.html',
  styleUrls: ['./cookie-banner.component.css']
})
export class CookieBannerComponent implements OnInit, OnDestroy {
  mostrarBanner = false;
  mostrarConfiguracion = false;
  private isBrowser: boolean;
  private subscriptions: Subscription = new Subscription();
  
  preferencias: CookiePreferences = {
    necesarias: true,
    preferencias: false,
    analiticas: false
  };

  constructor(
    private cookieService: CookieConsentService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.cookieService.consent$.subscribe(prefs => {
        if (prefs) {
          this.mostrarBanner = false;
          if (this.isBrowser) {
            this.aplicarCookies(prefs);
          }
        } else {
          this.mostrarBanner = true;
        }
      })
    );

    this.subscriptions.add(
      this.cookieService.showConfig$.subscribe(show => {
        this.mostrarConfiguracion = show;
        if (show) {
          const actuales = this.cookieService.obtenerPreferenciasActuales();
          if (actuales) {
            this.preferencias = { ...actuales };
          } else {
            this.preferencias = {
              necesarias: true,
              preferencias: false,
              analiticas: false
            };
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  aceptarTodas(): void {
    if (!this.isBrowser) return;
    
    const prefs: CookiePreferences = {
      necesarias: true,
      preferencias: true,
      analiticas: true
    };
    this.cookieService.guardarPreferencias(prefs);
    this.mostrarBanner = false;
    this.mostrarConfiguracion = false;
    this.aplicarCookies(prefs);
  }

  rechazarTodas(): void {
    if (!this.isBrowser) return;
    
    const prefs: CookiePreferences = {
      necesarias: true,
      preferencias: false,
      analiticas: false
    };
    this.cookieService.guardarPreferencias(prefs);
    this.mostrarBanner = false;
    this.mostrarConfiguracion = false;
    this.aplicarCookies(prefs);
  }

  guardarPreferenciasPersonalizadas(): void {
    if (!this.isBrowser) return;
    
    this.cookieService.guardarPreferencias(this.preferencias);
    this.mostrarBanner = false;
    this.mostrarConfiguracion = false;
    this.aplicarCookies(this.preferencias);
  }

  abrirConfiguracion(): void {
    if (!this.isBrowser) return;
    
    this.cookieService.abrirConfiguracion();
  }

  cerrarConfiguracion(): void {
    if (!this.isBrowser) return;
    
    this.cookieService.cerrarConfiguracion();
  }

  private aplicarCookies(prefs: CookiePreferences): void {
    if (!this.isBrowser) return;
    
    this.configurarCookiesNecesarias();
    
    if (prefs.preferencias) {
      this.configurarCookiesPreferencias();
    } else {
      this.eliminarCookiesPreferencias();
    }
    
    if (prefs.analiticas) {
      this.configurarCookiesAnaliticas();
    } else {
      this.eliminarCookiesAnaliticas();
    }
  }

  private configurarCookiesNecesarias(): void {
    if (!this.isBrowser) return;
    
    this.cookieService.setCookie('session_active', 'true', 1);
    this.cookieService.setCookie('csrf_token', this.generateCsrfToken(), 1);
  }

  private configurarCookiesPreferencias(): void {
    if (!this.isBrowser) return;
    
    const tema = localStorage.getItem('tema') || 'light';
    const idioma = localStorage.getItem('idioma') || 'es';
    
    this.cookieService.setCookie('user_theme', tema, 365);
    this.cookieService.setCookie('user_language', idioma, 365);
    this.cookieService.setCookie('preferences_saved', 'true', 365);
  }

  private eliminarCookiesPreferencias(): void {
    if (!this.isBrowser) return;
    
    this.cookieService.deleteCookie('user_theme');
    this.cookieService.deleteCookie('user_language');
    this.cookieService.deleteCookie('preferences_saved');
  }

  private configurarCookiesAnaliticas(): void {
    if (!this.isBrowser) return;
    
    try {
      if (typeof gtag !== 'undefined') {
        gtag('consent', 'update', {
          'analytics_storage': 'granted'
        });
      }
      
      const gaId = this.getGoogleAnalyticsId();
      if (gaId) {
        this.loadGoogleAnalytics(gaId);
      }
    } catch (e) {
      // Error silencioso
    }
  }

  private eliminarCookiesAnaliticas(): void {
    if (!this.isBrowser) return;
    
    try {
      if (typeof gtag !== 'undefined') {
        gtag('consent', 'update', {
          'analytics_storage': 'denied'
        });
      }
      
      this.cookieService.deleteCookie('_ga');
      this.cookieService.deleteCookie('_gid');
      this.cookieService.deleteCookie('_gat');
      this.cookieService.deleteCookie('AMP_TOKEN');
      
      if (this.isBrowser) {
        sessionStorage.removeItem('ga');
        sessionStorage.removeItem('_ga');
      }
    } catch (e) {
      // Error silencioso
    }
  }

  private getGoogleAnalyticsId(): string | null {
    if (!this.isBrowser) return null;
    
    const isProduction = window.location.hostname !== 'localhost' && 
                        !window.location.hostname.includes('127.0.0.1');
    
    if (isProduction) {
      return 'G-TU_ID_ANALYTICS_REAL';
    } else {
      return null;
    }
  }

  private loadGoogleAnalytics(gaId: string): void {
    if (!this.isBrowser || !gaId) return;
    
    try {
      if (window.gaInitialized) {
        return;
      }
      
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);

      if (!window.dataLayer) {
        window.dataLayer = [];
      }
      
      const gtagFn = function(...args: any[]) {
        if (window.dataLayer) {
          window.dataLayer.push(args);
        }
      };
      
      gtagFn('js', new Date());
      gtagFn('config', gaId);
      
      window.gaInitialized = true;
    } catch (e) {
      // Error silencioso
    }
  }

  private generateCsrfToken(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}