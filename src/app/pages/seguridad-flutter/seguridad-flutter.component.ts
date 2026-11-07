import { Component, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-seguridad-flutter',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './seguridad-flutter.component.html',
  styleUrls: ['./seguridad-flutter.component.css']
})
export class SeguridadFlutterComponent {
  mostrarModal = false;
  userEmail: string = 'Usuario';
  flutterUrlSafe: SafeResourceUrl;

  constructor(
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.flutterUrlSafe = this.sanitizer.bypassSecurityTrustResourceUrl('/flutter/index.html');

    if (isPlatformBrowser(this.platformId)) {
      try {
        const user = this.authService.getCurrentUser();
        if (user && user.email) {
          this.userEmail = user.email;
        }
      } catch (e) {
        console.warn('No se pudo leer el usuario', e);
      }
    }
  }

  abrirModulo() {
    this.mostrarModal = true;
    this.cdr.detectChanges();
  }

  cerrarModulo() {
    this.mostrarModal = false;
    this.cdr.detectChanges();
  }

  // ✅ ESTA ES LA MAGIA: Se ejecuta cuando Flutter termina de cargar
  onIframeLoad(event: Event) {
    const iframe = event.target as HTMLIFrameElement;
    
    if (iframe.contentWindow) {
      const token = this.authService.getToken();
      const user = this.authService.getCurrentUser();

      if (token && user) {
        const payload = {
          type: 'AUTH_TOKEN',
          token: token,
          user: {
            id: user.id,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            telefono: user.telefono || '',
            rol: user.rol || 'user'
          }
        };

        // Enviamos el token al Flutter que está dentro del iframe
        iframe.contentWindow.postMessage(payload, window.location.origin);
        console.log('📤 Auth enviada a Flutter:', payload.user.email);
      }
    }
  }
}