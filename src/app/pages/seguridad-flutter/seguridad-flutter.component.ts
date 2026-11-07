import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
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
export class SeguridadFlutterComponent implements OnInit {
  mostrarModal = false;
  readonly flutterUrl = '/flutter/index.html';
  userEmail: string = 'Usuario';
  Math = Math;
  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
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