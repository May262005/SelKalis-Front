import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  readonly flutterUrl = '/flutter/index.html';
  userEmail: string = 'Usuario';

  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const user = this.authService.getCurrentUser();
      if (user) {
        this.userEmail = user.email;
      }
    }
  }

  abrirModulo() {
    this.mostrarModal = true;
  }

  cerrarModulo() {
    this.mostrarModal = false;
  }
}