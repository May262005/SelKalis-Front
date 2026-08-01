// recuperar.component.ts
import { Component, ChangeDetectorRef, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recuperar',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './recuperar.component.html',
  styleUrls: ['./recuperar.component.css']
})
export class RecuperarComponent implements OnDestroy {
  email: string = '';
  mostrarVerificacion: boolean = false;
  codigo: string = '';
  tokenRecuperacion: string = '';
  mostrarCambioPassword: boolean = false;
  nuevaPassword: string = '';
  confirmarPassword: string = '';
  isLoading: boolean = false;
  showNuevaPassword: boolean = false;
  showConfirmarPassword: boolean = false;
  tiempoRestante: number = 0;
  private intervalo: any = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnDestroy() {
    if (this.intervalo) {
      clearInterval(this.intervalo);
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

  toggleNuevaPassword() {
    this.showNuevaPassword = !this.showNuevaPassword;
  }

  toggleConfirmarPassword() {
    this.showConfirmarPassword = !this.showConfirmarPassword;
  }

  iniciarTemporizador() {
    this.tiempoRestante = 90;
    this.cdr.detectChanges();

    if (this.intervalo) {
      clearInterval(this.intervalo);
    }

    this.intervalo = setInterval(() => {
      this.tiempoRestante--;
      this.cdr.detectChanges();

      if (this.tiempoRestante <= 0) {
        clearInterval(this.intervalo);
        this.intervalo = null;
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  solicitarRecuperacion() {
    if (!this.email) {
      this.showToast('Ingresa tu correo electronico', 'warning');
      return;
    }

    if (!this.email.includes('@') || !this.email.includes('.')) {
      this.showToast('Ingresa un correo electronico valido', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.solicitarRecuperacion(this.email).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        
        if (response.success) {
          setTimeout(() => {
            this.mostrarVerificacion = true;
            this.cdr.detectChanges();
            this.iniciarTemporizador();
            this.showToast('Codigo enviado a tu correo electronico', 'success');
          }, 100);
        } else {
          this.showToast(response.error || 'Error al enviar el codigo', 'error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        const msg = error.error?.error || 'Error al enviar el codigo de recuperacion';
        this.showToast(msg, 'error');
      }
    });
  }

  verificarCodigo() {
    if (!this.codigo || this.codigo.length < 6) {
      this.showToast('Ingresa el codigo de 6 digitos', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.verificarCodigo(this.email, this.codigo).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        
        if (response.success) {
          setTimeout(() => {
            this.tokenRecuperacion = response.token;
            this.mostrarCambioPassword = true;
            this.cdr.detectChanges();
            this.showToast('Codigo verificado correctamente', 'success');
          }, 100);
        } else {
          this.showToast(response.error || 'Codigo incorrecto', 'error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        const msg = error.error?.error || 'Error al verificar el codigo';
        this.showToast(msg, 'error');
      }
    });
  }

  cambiarPassword() {
    if (!this.nuevaPassword || !this.confirmarPassword) {
      this.showToast('Completa todos los campos', 'warning');
      return;
    }

    if (this.nuevaPassword.length < 6) {
      this.showToast('La contrasena debe tener al menos 6 caracteres', 'warning');
      return;
    }

    if (this.nuevaPassword !== this.confirmarPassword) {
      this.showToast('Las contrasenas no coinciden', 'error');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.cambiarPasswordRecuperacion(
      this.email,
      this.tokenRecuperacion,
      this.nuevaPassword
    ).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        
        if (response.success) {
          this.showToast('Contrasena actualizada correctamente', 'success');
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        } else {
          this.showToast(response.error || 'Error al cambiar la contrasena', 'error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        const msg = error.error?.error || 'Error al cambiar la contrasena';
        this.showToast(msg, 'error');
      }
    });
  }

  reenviarCodigo() {
    if (this.tiempoRestante > 0) {
      this.showToast(`Espera ${this.tiempoRestante} segundos para reenviar`, 'warning');
      return;
    }

    if (!this.email) {
      this.showToast('Ingresa tu correo electronico', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.reenviarCodigo(this.email).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        
        if (response.success) {
          this.iniciarTemporizador();
          this.showToast('Nuevo codigo enviado a tu correo', 'success');
        } else {
          this.showToast(response.error || 'Error al reenviar el codigo', 'error');
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.showToast('Error al reenviar el codigo', 'error');
      }
    });
  }

  volverAlLogin(event: Event) {
    event.preventDefault();
    this.router.navigate(['/login']);
  }
}