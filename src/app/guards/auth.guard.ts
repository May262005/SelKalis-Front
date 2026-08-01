// auth.guard.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class authGuard implements CanActivate {
  constructor(
    private router: Router,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  canActivate(): boolean {
    // Si no estamos en el navegador, permitir paso (SSR)
    if (!isPlatformBrowser(this.platformId)) {
      return true;
    }

    if (this.authService.isLoggedIn()) {
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}