// login.component.ts
import { Component, ChangeDetectorRef, Inject, PLATFORM_ID, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DispositivoService } from '../../services/dispositivo.service';
import { WebAuthnService } from '../../services/webauthn.service';

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
  // ============ ETAPA 2 — WebAuthn / Biometría ============
  biometriaDisponible = false;
  biometriaCargando = false;
  biometriaError = '';
  biometriaRegistrada = false;
  mostrarModalTelefono = false;
  telefonoModal = '';
  telefonoModalError = '';
  telefonoModalCargando = false;
  // =======================================================

  private loadingTimeout: any = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    private dispositivoService: DispositivoService,
    private webAuthnService: WebAuthnService
  ) {}

  // ============ ETAPA 2 — MÉTODOS NUEVOS ============

  async ngOnChanges(): Promise<void> {}
  async ionViewWillEnter(): Promise<void> {}

  /** Detecta biometría disponible al cargar la página */
  async detectarBiometria(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.biometriaDisponible = await this.webAuthnService.disponible();
  }

  /** Login con biometría */
  async loginConBiometria(): Promise<void> {
    this.biometriaError = '';

    if (!this.email || !this.email.trim()) {
      this.biometriaError = 'Primero escribe tu correo electrónico';
      return;
    }

    const email = this.email.trim().toLowerCase();
    this.biometriaCargando = true;

    try {
      // 1. Pedir opciones al backend
      const opcionesRes = await this.webAuthnService.opcionesLogin(email).toPromise();

      if (!opcionesRes?.success) {
        throw new Error(opcionesRes?.error || 'Biometría no disponible');
      }

      // 2. Pedir al navegador huella/FaceID
      const credential = await this.webAuthnService.obtenerCredencial(opcionesRes.options);

      // 3. Verificar en el backend
      const verificacion = await this.webAuthnService
        .verificarLogin(email, credential)
        .toPromise();

      if (!verificacion?.success) {
        throw new Error(verificacion?.error || 'Verificación fallida');
      }

      // 4. Guardar sesión como en login normal
      localStorage.setItem('sk_token', verificacion.token);
      localStorage.setItem('sk_user_data', JSON.stringify(verificacion.user));

      this.showToast('Bienvenido a SelKalis', 'success');
      this.redirigirSegunRol();
    } catch (e: any) {
      console.error(e);
      this.biometriaError =
        e?.error?.error ||
        e?.message ||
        'No se pudo autenticar con biometría';
    } finally {
      this.biometriaCargando = false;
    }
  }

  /** Después del login exitoso, verifica si falta vincular teléfono */
  private verificarVinculacionPostLogin(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    // Si no tiene teléfono → mostrar modal
    if (!user.telefono) {
      this.mostrarModalTelefono = true;
      return;
    }

    // Si ya tiene teléfono pero no biometría → ofrecer activarla
    if (!this.biometriaRegistrada && this.biometriaDisponible) {
      // Esperar 1s para no interrumpir la transición
      setTimeout(() => {
        const quiere = confirm(
          '¿Quieres activar el inicio de sesión con biometría para la próxima vez?'
        );
        if (quiere) {
          this.registrarBiometria();
        }
      }, 800);
    }
  }

  /** Guarda el teléfono del modal */
  guardarTelefonoModal(): void {
    this.telefonoModalError = '';
    const tel = this.telefonoModal.trim();
    if (!/^\+?[0-9]{10,15}$/.test(tel)) {
      this.telefonoModalError = 'Número inválido (10-15 dígitos, opcional +)';
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;

    this.telefonoModalCargando = true;
    this.dispositivoService.vincularTelefono(user.id, tel).subscribe({
      next: async () => {
        // Asociar el dispositivo también
        this.dispositivoService
          .asociarDispositivo(user.id, {
            device_id: this.dispositivoService.obtenerDeviceId(),
            device_platform: this.dispositivoService.detectarPlataforma(),
            device_model: this.dispositivoService.detectarModelo()
          })
          .subscribe({
            next: () => {
              this.telefonoModalCargando = false;
              this.mostrarModalTelefono = false;
              this.authService.updateUserData({ telefono: tel });
              this.showToast('Teléfono y dispositivo vinculados', 'success');

              // Ofrecer biometría
              if (this.biometriaDisponible) {
                setTimeout(() => {
                  const quiere = confirm(
                    '¿Activar biometría para próximos inicios de sesión?'
                  );
                  if (quiere) this.registrarBiometria();
                }, 500);
              }
            },
            error: (err) => {
              this.telefonoModalCargando = false;
              this.telefonoModalError =
                err?.error?.error || 'Error al asociar dispositivo';
            }
          });
      },
      error: (err) => {
        this.telefonoModalCargando = false;
        this.telefonoModalError = err?.error?.error || 'Error al guardar teléfono';
      }
    });
  }

  /** Registra biometría WebAuthn para el usuario logueado */
  async registrarBiometria(): Promise<void> {
    const user = this.authService.getCurrentUser();
    const token = this.authService.getToken();
    if (!user || !token) return;

    this.biometriaCargando = true;
    this.biometriaError = '';

    try {
      const opcionesRes = await this.webAuthnService.opcionesRegistro(token).toPromise();
      if (!opcionesRes?.success) throw new Error('Error obteniendo opciones');

      const credential = await this.webAuthnService.crearCredencial(opcionesRes.options);
      const deviceLabel = this.dispositivoService.detectarModelo();

      const verificacion = await this.webAuthnService
        .verificarRegistro(token, credential, deviceLabel)
        .toPromise();

      if (!verificacion?.success) throw new Error('Error al registrar');

      this.biometriaRegistrada = true;
      this.showToast('Biometría activada correctamente', 'success');
    } catch (e: any) {
      this.biometriaError = e?.error?.error || e?.message || 'Error al registrar biometría';
    } finally {
      this.biometriaCargando = false;
    }
  }

  // =======================================================

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

    this.detectarBiometria();
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
        this.verificarVinculacionPostLogin();
        setTimeout(() => this.redirigirSegunRol() , 1200);
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