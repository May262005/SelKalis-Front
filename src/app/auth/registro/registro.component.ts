// registro.component.ts
import { Component, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent {
  nombre: string = '';
  apellido: string = '';
  email: string = '';
  telefono: string = '';
  password: string = '';
  confirmPassword: string = '';
  isLoading: boolean = false;
  
  private _aceptaTerminos: boolean = false;

  set aceptaTerminos(value: boolean) {
    this._aceptaTerminos = value;
    if (isPlatformBrowser(this.platformId)) {
      if (value) {
        localStorage.setItem('selkalis_acepta_terminos', 'true');
      } else {
        localStorage.removeItem('selkalis_acepta_terminos');
      }
    }
  }

  get aceptaTerminos(): boolean {
    return this._aceptaTerminos;
  }

  passwordStrength: number = 0;
  showPasswordStrength: boolean = false;
  errorMessages: { [key: string]: string } = {};

  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const guardado = localStorage.getItem('selkalis_acepta_terminos');
      this._aceptaTerminos = guardado === 'true';
    }
  }

  onTerminosChange(): void {
    // El estado ya se actualiza automáticamente por el setter
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLanding(): void {
    this.router.navigate(['/']);
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

  checkPasswordStrength(): void {
    const p = this.password;
    if (!p) { 
      this.passwordStrength = 0; 
      return; 
    }

    let strength = 0;
    
    if (p.length >= 6) strength += 10;
    if (p.length >= 8) strength += 10;
    if (p.length >= 10) strength += 10;
    if (/\d/.test(p)) strength += 15;
    if (/[A-Z]/.test(p)) strength += 15;
    if (/[a-z]/.test(p)) strength += 10;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) strength += 20;
    if (p.length >= 12) strength += 10;
    
    this.passwordStrength = Math.min(strength, 100);
  }

  getStrengthLevel(): { level: number; text: string; class: string; barClass: string } {
    if (this.passwordStrength === 0) {
      return { level: 0, text: '', class: '', barClass: '' };
    }
    if (this.passwordStrength < 30) {
      return { level: 1, text: 'Debil', class: 'weak', barClass: 'weak' };
    }
    if (this.passwordStrength < 55) {
      return { level: 2, text: 'Regular', class: 'medium', barClass: 'medium' };
    }
    if (this.passwordStrength < 80) {
      return { level: 3, text: 'Buena', class: 'strong', barClass: 'strong' };
    }
    return { level: 4, text: 'Muy fuerte', class: 'very-strong', barClass: 'very-strong' };
  }

  getStrengthBars(): number[] {
    const level = this.getStrengthLevel().level;
    return [1, 2, 3, 4].map(i => i <= level ? 1 : 0);
  }

  getRequirements(): { met: boolean; text: string }[] {
    const p = this.password;
    return [
      { met: p.length >= 6, text: 'Minimo 6 caracteres' },
      { met: p.length >= 8, text: 'Minimo 8 caracteres' },
      { met: /[A-Z]/.test(p), text: 'Una mayuscula' },
      { met: /[a-z]/.test(p), text: 'Una minuscula' },
      { met: /\d/.test(p), text: 'Un numero' },
      { met: /[!@#$%^&*(),.?":{}|<>]/.test(p), text: 'Caracter especial' }
    ];
  }

  passwordsMatch(): boolean {
    return !!this.confirmPassword && this.password === this.confirmPassword;
  }

  passwordsMismatch(): boolean {
    return !!this.confirmPassword && this.password !== this.confirmPassword;
  }

  onSubmit(): void {
    if (!this.aceptaTerminos) {
      this.showToast('Debes aceptar los terminos y condiciones para continuar', 'error');
      return;
    }

    if (!this.nombre || !this.nombre.trim()) {
      this.showToast('Por favor, ingresa tu nombre', 'error');
      return;
    }

    if (!this.apellido || !this.apellido.trim()) {
      this.showToast('Por favor, ingresa tu apellido', 'error');
      return;
    }

    if (!this.email || !this.email.trim()) {
      this.showToast('Por favor, ingresa tu correo electronico', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email.trim())) {
      this.showToast('Por favor, ingresa un correo electronico valido. Ejemplo: usuario@correo.com', 'error');
      return;
    }

    if (!this.password) {
      this.showToast('Por favor, ingresa una contrasena', 'error');
      return;
    }

    if (this.password.length < 6) {
      this.showToast('La contrasena debe tener al menos 6 caracteres.', 'error');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.showToast('Las contrasenas no coinciden. Por favor, verificalas.', 'error');
      return;
    }

    if (this.telefono && this.telefono.length > 0) {
      const telefonoLimpio = this.telefono.replace(/[\s\-()]/g, '');
      if (telefonoLimpio.length < 7 || telefonoLimpio.length > 15 || !/^\d+$/.test(telefonoLimpio)) {
        this.showToast('El telefono debe tener entre 7 y 15 digitos. Solo numeros, guiones y espacios.', 'error');
        return;
      }
    }

    this.procesarRegistro();
  }

  procesarRegistro(): void {
    this.isLoading = true;

    const userData = {
      nombre: this.nombre.trim(),
      apellido: this.apellido.trim(),
      email: this.email.trim().toLowerCase(),
      telefono: this.telefono || undefined,
      password: this.password
    };

    this.authService.register(userData).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        this.showToast('Cuenta creada exitosamente. Bienvenido a SelKalis.', 'success');
        
        this.authService.login(this.email, this.password).subscribe({
          next: (loginResponse: any) => {
            this.router.navigate(['/dashboard']);
          },
          error: (error: any) => {
            this.showToast('Registro exitoso, por favor inicia sesion', 'info');
            this.router.navigate(['/login']);
          }
        });
      },
      error: (error: any) => {
        this.isLoading = false;
        this.cdr.detectChanges();

        let mensaje = 'Error al registrar usuario. Por favor, intenta de nuevo.';

        if (error.error?.error) {
          mensaje = error.error.error;
        } else if (error.status === 400) {
          if (error.error?.error) {
            mensaje = error.error.error;
          } else {
            mensaje = 'Por favor, verifica que todos los datos sean correctos.';
          }
        } else if (error.status === 409) {
          mensaje = 'Este correo electronico ya esta registrado. Por favor, utiliza otro o inicia sesion.';
        } else if (error.status === 500) {
          mensaje = 'Hubo un problema en el servidor. Por favor, intenta mas tarde.';
        }

        this.showToast(mensaje, 'error');
      }
    });
  }
}