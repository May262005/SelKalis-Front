// guards/admin.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) return false;

  const token = localStorage.getItem('sk_token');
  const userRaw = localStorage.getItem('user');

  if (!token || !userRaw) {
    router.navigate(['/login']);
    return false;
  }

  try {
    const user = JSON.parse(userRaw);
    if (user.rol === 'admin') {
      return true;
    }
    // Usuario autenticado pero sin permisos de admin
    router.navigate(['/dashboard']);
    return false;
  } catch {
    router.navigate(['/login']);
    return false;
  }
};