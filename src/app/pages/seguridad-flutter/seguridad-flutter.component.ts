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
  
  // Apunta al index.html de Flutter que copiamos en public/flutter
  readonly flutterUrl = '/flutter/index.html';
  readonly userEmail: string;

  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    const user = this.authService.getCurrentUser();
    this.userEmail = user ? user.email : 'Usuario';
  }

  abrirModulo() {
    this.mostrarModal = true;
  }

  cerrarModulo() {
    this.mostrarModal = false;
  }
}