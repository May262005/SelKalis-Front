import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class FlutterBridgeService {
  private flutterReady$ = new BehaviorSubject<boolean>(false);
  readonly ready$ = this.flutterReady$.asObservable();

  private iframe: HTMLIFrameElement | null = null;
  private isBrowser: boolean;
  private listenerRegistrado = false;

  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  registrarIframe(iframe: HTMLIFrameElement): void {
    if (!this.isBrowser) return;
    this.iframe = iframe;

    if (!this.listenerRegistrado) {
      window.addEventListener('message', this.onFlutterMessage.bind(this));
      this.listenerRegistrado = true;
    }

    iframe.addEventListener('load', () => {
      console.log('✅ Flutter iframe cargado');
      this.enviarAuthAFlutter();
    });
  }

  enviarAuthAFlutter(): void {
    if (!this.iframe?.contentWindow) return;

    const token = this.authService.getToken();
    const user = this.authService.getCurrentUser();

    if (!token || !user) {
      console.warn('⚠️ No hay sesión para enviar a Flutter');
      return;
    }

    const payload = {
      type: 'AUTH_TOKEN',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono || '',
        rol: user.rol || 'user'
      }
    };

    this.iframe.contentWindow.postMessage(payload, window.location.origin);
    console.log('📤 Auth enviada a Flutter:', payload.user.email);
  }

  private onFlutterMessage(event: MessageEvent): void {
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'FLUTTER_READY':
        console.log('✅ Flutter notificó READY');
        this.flutterReady$.next(true);
        this.enviarAuthAFlutter();
        break;

      case 'TELEFONO_VINCULADO':
        console.log('📱 Teléfono vinculado:', data.telefono);
        if (data.telefono) {
          this.authService.updateUserData({ telefono: data.telefono });
        }
        break;

      case 'DISPOSITIVO_ASOCIADO':
        console.log('💻 Dispositivo asociado:', data.device_id);
        break;

      case 'BIOMETRIA_HABILITADA':
        console.log('🔐 Biometría:', data.enabled);
        break;
    }
  }

  enviarAFlutter(mensaje: any): void {
    if (!this.iframe?.contentWindow) return;
    this.iframe.contentWindow.postMessage(mensaje, window.location.origin);
  }
}