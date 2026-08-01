// src/app/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();

    let authReq = req;

    const apiUrls = [
      'localhost:3000',
      'selkalis-auth-service.onrender.com',
      'selkalis-tratamientos-service.onrender.com',
      'selkalis-citas-service.onrender.com',
      'selkalis-estudios-service.onrender.com',
      'selkalis-documentos-service.onrender.com'
    ];

    const esApiUrl = apiUrls.some(url => req.url.includes(url));
    const esFormData = req.body instanceof FormData;

    if (token && esApiUrl) {
      const headers: { [name: string]: string } = {
        'Authorization': `Bearer ${token}`
      };

      // No fijar Content-Type cuando el body es FormData.
      // El navegador debe generarlo automaticamente junto con el boundary
      // (multipart/form-data; boundary=...), de lo contrario el backend
      // no puede leer el archivo correctamente.
      if (!esFormData) {
        headers['Content-Type'] = 'application/json';
      }

      authReq = req.clone({
        setHeaders: headers
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        const currentUrl = this.router.url;
        const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth');
        const isDocumentosPage = currentUrl.includes('/documentos');

        if (error.status === 401 && !isLoginPage) {
          if (isDocumentosPage) {
            return throwError(() => error);
          }

          this.authService.logout();
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}