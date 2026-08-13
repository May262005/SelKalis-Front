// login.component.ts
import { Component, ChangeDetectorRef, Inject, PLATFORM_ID, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';

const SK_TOKEN = 'sk_token';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  showPassword: boolean = false;
  rememberMe: boolean = false;

  private loadingTimeout: any = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const creds = this.authService.obtenerCredenciales();
    if (creds) {
      this.email = creds.email;
      this.password = creds.password;
      this.rememberMe = true;
    }

    if (this.hasValidSession()) {
      this.redirigirSegunRol({ replaceUrl: true });
    }
  }

  ngOnDestroy(): void {
    this.clearLoadingTimeout();
  }

  private hasValidSession(): boolean {
    const token = localStorage.getItem(SK_TOKEN);
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < nowSec) {
        localStorage.removeItem(SK_TOKEN);
        return false;
      }
      return true;
    } catch {
      localStorage.removeItem(SK_TOKEN);
      return false;
    }
  }

  // Usa el usuario que AuthService ya conoce (mismo mecanismo que header/mobile-menu)
  private redirigirSegunRol(navExtras: { replaceUrl?: boolean } = {}): void {
    const user = this.authService.getCurrentUser();
    const destino = user?.rol === 'admin' ? '/admin' : '/dashboard';
    this.router.navigate([destino], navExtras);
  }

  private clearLoadingTimeout(): void {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  private setLoading(value: boolean): void {
    this.clearLoadingTimeout();
    this.isLoading = value;
    this.cdr.detectChanges();

    if (value) {
      this.loadingTimeout = setTimeout(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.showToast('La solicitud tardó demasiado. Intenta de nuevo.', 'warning');
      }, 15000);
    }
  }

  onInputChange(): void {
    if (this.isLoading) this.setLoading(false);
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onRememberMeChange(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.rememberMe) {
      this.authService.eliminarCredenciales();
      this.email = '';
      this.password = '';
    }
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const existingToast = document.getElementById('selkalis-toast');
    if (existingToast) existingToast.remove();

    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.id = 'selkalis-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      padding: 18px 32px;
      background: #E8F0FE;
      border-radius: 14px;
      box-shadow: 0 6px 24px rgba(31, 58, 95, 0.18);
      border: 1px solid #B8D4F0;
      font-family: 'Segoe UI', system-ui, sans-serif;
      z-index: 9999;
      max-width: 90vw;
      min-width: 320px;
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
    `;

    const icon = document.createElement('i');
    icon.className = `fas ${iconMap[type]}`;
    icon.style.cssText = `
      font-size: 28px;
      color: #4A6FA5;
      flex-shrink: 0;
      width: 32px;
      text-align: center;
    `;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    textSpan.style.cssText = `
      font-size: 16px;
      font-weight: 500;
      color: #1F3A5F;
      line-height: 1.5;
      word-break: break-word;
    `;

    container.appendChild(icon);
    container.appendChild(textSpan);
    toast.appendChild(container);
    document.body.appendChild(toast);
    toast.offsetHeight;

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-100px)';
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 400);
    }, 4000);
  }

  onSubmit(): void {
    if (!this.email || !this.email.trim()) {
      this.showToast('Por favor, ingresa tu correo electrónico', 'warning');
      return;
    }
    if (!this.password || !this.password.trim()) {
      this.showToast('Por favor, ingresa tu contraseña', 'warning');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email.trim())) {
      this.showToast('Por favor, ingresa un correo electrónico válido', 'warning');
      return;
    }

    this.setLoading(true);

    this.authService.login(this.email.trim(), this.password, this.rememberMe).subscribe({
      next: (response: any) => {
        this.setLoading(false);
        this.showToast('Bienvenido a SelKalis', 'success');
        this.redirigirSegunRol();
      },
      error: (error: any) => {
        this.setLoading(false);

        let mensaje = 'Error al iniciar sesión. Por favor, intenta de nuevo.';
        if (error.error?.error) mensaje = error.error.error;
        else if (error.status === 401) mensaje = 'Correo o contraseña incorrectos. Verifica tus datos.';
        else if (error.status === 400) mensaje = 'Por favor, verifica que todos los datos sean correctos.';
        else if (error.status === 500) mensaje = 'Hubo un problema en el servidor. Por favor, intenta más tarde.';
        else if (error.status === 0) mensaje = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';

        this.showToast(mensaje, 'error');
      }
    });
  }
}