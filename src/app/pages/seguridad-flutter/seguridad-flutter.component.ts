import { Component, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'; // ✅ IMPORTANTE
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
  
  // ✅ Aquí guardaremos la URL ya "confiada"
  flutterUrlSafe: SafeResourceUrl;

  constructor(
    private authService: AuthService,
    private sanitizer: DomSanitizer, // ✅ Inyectamos el sanitizador
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    // ✅ Marcamos la URL de Flutter como segura al construir el componente
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
}