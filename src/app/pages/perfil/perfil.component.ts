import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationsService, NotificationPreferences } from '../../services/notifications.service';
import { WebAuthnService } from '../../services/webauthn.service';
import { DispositivoService } from '../../services/dispositivo.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
  usuario = {
    id: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    created_at: '',
    ultimo_login: ''
  };

  usuarioEdit = { ...this.usuario };

  preferencias = { email: true, push: true };
  notificationPreferences: NotificationPreferences = {
    push_enabled: false,
    medicamentos_enabled: true,
    citas_enabled: true,
    soporte_enabled: true,
    timezone: 'America/Mexico_City'
  };
  notificationError = '';
  pushLoading = false;
  preferencesLoading = true;
  notificationPermission = 'unknown';
  cameraPermission = 'unknown';
  cameraError = '';
  cameraLoading = false;
  biometriaDisponible = false;
  biometriaRegistrada = false;
  biometriaCredencialExistente = false;
  biometriaLoading = false;

  // Modales
  mostrarModalEditar = false;
  mostrarModalVerificar = false;
  mostrarPasswordModal = false;
  mostrarModalCambiarPassword = false;

  // Contraseñas
  passwordVerificacion = '';
  mostrarPasswordVerificacion = false;
  passwordDescifrada = '';

  passwords = { actual: '', nueva: '', confirmar: '' };
  mostrarActual = false;
  mostrarNueva = false;
  mostrarConfirmar = false;

  // Loadings
  isLoadingGuardar = false;
  isLoadingVerificar = false;
  isLoadingCambiarPassword = false;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private notificationsService: NotificationsService,
    private webAuthn: WebAuthnService,
    private dispositivoService: DispositivoService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    this.cargarPerfil();
    
    if (isPlatformBrowser(this.platformId)) {
      const savedPrefs = localStorage.getItem('preferencias');
      if (savedPrefs) this.preferencias = JSON.parse(savedPrefs);
    }
    this.cargarPreferenciasNotificaciones();
    void this.cargarEstadoBiometria();
    this.cargarEstadoPermisos();
  }

  // ✅ NUEVO: Método para cargar el perfil
  cargarPerfil() {
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.warn('No hay usuario autenticado');
      return;
    }

    // Primero cargar datos del token
    this.usuario = {
      id: user.id,
      nombre: user.nombre || '',
      apellido: user.apellido || '',
      email: user.email || '',
      telefono: user.telefono || '',
      created_at: user.created_at || '',
      ultimo_login: user.ultimo_login || ''
    };
    this.usuarioEdit = { ...this.usuario };

    // ✅ Luego cargar datos actualizados del servidor
    this.authService.getUsuario(user.id).subscribe({
      next: (res) => {
        console.log('📥 Datos recibidos del servidor:', res);
        
        if (res && res.user) {
          // ✅ Actualizar TODOS los campos
          this.usuario = {
            id: res.user.id || this.usuario.id,
            nombre: res.user.nombre || this.usuario.nombre,
            apellido: res.user.apellido || this.usuario.apellido,
            email: res.user.email || this.usuario.email,
            telefono: res.user.telefono || '',
            created_at: res.user.created_at || this.usuario.created_at,
            ultimo_login: res.user.ultimo_login || ''
          };
          
          this.usuarioEdit = { ...this.usuario };
          
          // ✅ Actualizar también el usuario en el AuthService
          // Esto es importante para que el token tenga los datos actualizados
          const currentUser = this.authService.getCurrentUser();
          if (currentUser) {
            const updatedUser = {
              ...currentUser,
              telefono: this.usuario.telefono,
              ultimo_login: this.usuario.ultimo_login
            };
            // Guardar en el subject del AuthService
            // Nota: Esto requiere un método en AuthService para actualizar el usuario
            // Si no existe, podemos actualizar el token manualmente
            this.authService.updateUserData(updatedUser);
          }
          
          this.cdr.detectChanges();
          
          // ✅ Mostrar logs para depuración
          console.log('✅ Perfil actualizado:');
          console.log('  📱 Teléfono:', this.usuario.telefono || '(No especificado)');
          console.log('  🕐 Último login:', this.usuario.ultimo_login || 'Sin registros');
        }
      },
      error: (err) => {
        console.error('❌ Error al cargar perfil:', err);
        this.showToast(err.userMessage || 'No se pudo cargar la información del perfil', 'warning');
      }
    });
  }

  // ── Toast ──────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    const existing = document.getElementById('selkalis-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'selkalis-toast';
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:18px;font-weight:bold;">${icons[type]}</span>
        <span>${message}</span>
      </div>`;

    toast.className = `selkalis-toast selkalis-toast--${type}`;
    document.body.appendChild(toast);
    toast.offsetHeight;
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
    }, 4000);
  }

  // ── Modal Editar Perfil ────────────────────────────────
  abrirModalEditar() {
    this.usuarioEdit = { ...this.usuario };
    this.mostrarModalEditar = true;
    document.body.style.overflow = 'hidden';
  }

  cerrarModalEditar() {
    this.mostrarModalEditar = false;
    document.body.style.overflow = '';
  }

  guardarPerfil() {
    const { id, nombre, apellido, telefono } = this.usuarioEdit;
    this.isLoadingGuardar = true;

    this.authService.actualizarUsuario(id, { nombre, apellido, telefono })
      .subscribe({
        next: (res) => {
          console.log('✅ Perfil actualizado en servidor:', res);
          
          if (res && res.user) {
            // ✅ Actualizar todos los campos con los datos del servidor
            this.usuario = { ...this.usuario, ...res.user };
            this.usuarioEdit = { ...this.usuario };
            
            // ✅ Actualizar el usuario en el AuthService
            const currentUser = this.authService.getCurrentUser();
            if (currentUser) {
              this.authService.updateUserData({
                ...currentUser,
                nombre: res.user.nombre,
                apellido: res.user.apellido,
                telefono: res.user.telefono
              });
            }
            
            this.cdr.detectChanges();
            this.showToast('Perfil actualizado correctamente', 'success');
          }
          
          this.isLoadingGuardar = false;
          this.cerrarModalEditar();
        },
        error: (err) => {
          this.isLoadingGuardar = false;
          const msg = err.userMessage || err.error?.error || 'Error al actualizar el perfil';
          this.showToast(msg, 'error');
          this.cdr.detectChanges();
        }
      });
  }

  // ── Modal Verificar Identidad ──────────────────────────
  abrirModalVerificar() {
    this.passwordVerificacion = '';
    this.mostrarPasswordVerificacion = false;
    this.mostrarModalVerificar = true;
    document.body.style.overflow = 'hidden';
  }

  cerrarModalVerificar() {
    this.mostrarModalVerificar = false;
    document.body.style.overflow = '';
  }

  verificarIdentidad() {
    if (!this.passwordVerificacion) {
      this.showToast('Ingresa tu contraseña', 'warning');
      return;
    }

    this.isLoadingVerificar = true;

    this.authService.login(this.usuario.email, this.passwordVerificacion, false)
      .subscribe({
        next: (response) => {
          console.log('✅ Verificación exitosa:', response);
          this.passwordDescifrada = this.passwordVerificacion;
          this.isLoadingVerificar = false;
          this.cerrarModalVerificar();
          this.abrirPasswordModal();
          
          // ✅ Actualizar el perfil después de verificar (para obtener último login)
          this.cargarPerfil();
          
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isLoadingVerificar = false;
          const msg = err.userMessage || 'Contraseña incorrecta';
          this.showToast(msg, 'error');
          this.cdr.detectChanges();
        }
      });
  }

  // ── Modal Mostrar Contraseña ───────────────────────────
  abrirPasswordModal() {
    this.mostrarPasswordModal = true;
    document.body.style.overflow = 'hidden';
  }

  cerrarPasswordModal() {
    this.mostrarPasswordModal = false;
    this.passwordDescifrada = '';
    document.body.style.overflow = '';
  }

  copiarPassword() {
    navigator.clipboard.writeText(this.passwordDescifrada)
      .then(() => this.showToast('Contraseña copiada al portapapeles', 'info'))
      .catch(() => this.showToast('No se pudo copiar', 'error'));
  }

  // ── Modal Cambiar Contraseña ───────────────────────────
  abrirModalCambiarPassword() {
    this.passwords = { actual: '', nueva: '', confirmar: '' };
    this.mostrarActual = this.mostrarNueva = this.mostrarConfirmar = false;
    this.mostrarModalCambiarPassword = true;
    document.body.style.overflow = 'hidden';
  }

  cerrarModalCambiarPassword() {
    this.mostrarModalCambiarPassword = false;
    document.body.style.overflow = '';
  }

  cambiarPassword() {
    if (!this.passwords.actual || !this.passwords.nueva || !this.passwords.confirmar) {
      this.showToast('Completa todos los campos', 'warning');
      return;
    }

    if (this.passwords.nueva !== this.passwords.confirmar) {
      this.showToast('Las contraseñas nuevas no coinciden', 'error');
      return;
    }

    if (this.passwords.nueva.length < 6) {
      this.showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }

    this.isLoadingCambiarPassword = true;

    this.authService.cambiarPassword(
      this.usuario.id,
      this.passwords.actual,
      this.passwords.nueva
    ).subscribe({
      next: () => {
        this.isLoadingCambiarPassword = false;
        this.cerrarModalCambiarPassword();
        this.showToast('Contraseña cambiada correctamente', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingCambiarPassword = false;
        const msg = err.userMessage || err.error?.error || 'Error al cambiar la contraseña';
        this.showToast(msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ── Preferencias ───────────────────────────────────────
  togglePreferencia(pref: 'email' | 'push') {
    if (pref === 'push') {
      void this.cambiarPush();
      return;
    }
    this.preferencias[pref] = !this.preferencias[pref];
    localStorage.setItem('preferencias', JSON.stringify(this.preferencias));
  }

  cargarPreferenciasNotificaciones(): void {
    this.preferencesLoading = true;
    this.notificationsService.getPreferences().subscribe({
      next: response => {
        this.notificationPreferences = response.data;
        this.preferencesLoading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.notificationError = error.error?.error || 'No se pudieron cargar las preferencias de notificación.';
        this.preferencesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  cambiarCategoriaNotificacion(categoria: 'medicamentos_enabled' | 'citas_enabled' | 'soporte_enabled'): void {
    const updated = {
      ...this.notificationPreferences,
      [categoria]: !this.notificationPreferences[categoria]
    };
    this.notificationPreferences = updated;
    this.notificationsService.updatePreferences({
      medicamentos_enabled: updated.medicamentos_enabled,
      citas_enabled: updated.citas_enabled,
      soporte_enabled: updated.soporte_enabled,
      timezone: updated.timezone
    }).subscribe({
      next: response => this.notificationPreferences = response.data,
      error: error => {
        this.notificationPreferences = { ...this.notificationPreferences, [categoria]: !updated[categoria] };
        this.notificationError = error.error?.error || 'No se pudo guardar la preferencia.';
        this.cdr.detectChanges();
      }
    });
  }

  async cambiarPush(): Promise<void> {
    if (this.pushLoading) return;
    this.pushLoading = true;
    this.notificationError = '';
    try {
      if (this.notificationPreferences.push_enabled) {
        await this.notificationsService.disablePush();
        this.notificationPreferences = { ...this.notificationPreferences, push_enabled: false };
      } else {
        if (isPlatformBrowser(this.platformId) && 'Notification' in window && Notification.permission === 'denied') {
          throw new Error('Las notificaciones están bloqueadas en el navegador. Habilítalas desde los ajustes del sitio.');
        }
        await this.notificationsService.enablePush();
        this.notificationPreferences = { ...this.notificationPreferences, push_enabled: true };
        this.notificationPermission = 'granted';
      }
    } catch (error) {
      this.notificationError = error instanceof Error ? error.message : 'No se pudo actualizar el permiso de notificaciones.';
      this.cargarPreferenciasNotificaciones();
      this.cargarEstadoPermisos();
    } finally {
      this.pushLoading = false;
      this.cdr.detectChanges();
    }
  }

  private cargarEstadoPermisos(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported';
    if (!navigator.permissions?.query) {
      this.cameraPermission = 'unsupported';
      return;
    }
    navigator.permissions.query({ name: 'camera' as PermissionName }).then(permission => {
      this.cameraPermission = permission.state;
      this.cdr.detectChanges();
    }).catch(() => {
      this.cameraPermission = 'unknown';
      this.cdr.detectChanges();
    });
  }

  get cameraPermissionLabel(): string {
    const labels: Record<string, string> = {
      granted: 'Permitida',
      denied: 'Bloqueada',
      prompt: 'Se solicitará al tomar una foto',
      unsupported: 'El navegador no informa el estado',
      unknown: 'No se pudo consultar'
    };
    return labels[this.cameraPermission] || 'No disponible';
  }

  get notificationPermissionLabel(): string {
    const labels: Record<string, string> = {
      granted: 'Permitidas',
      denied: 'Bloqueadas en el navegador',
      default: 'Aún no solicitadas',
      unsupported: 'No disponible en este navegador',
      unknown: 'No se pudo consultar'
    };
    return labels[this.notificationPermission] || 'No disponible';
  }

  async solicitarPermisoCamara(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !navigator.mediaDevices?.getUserMedia) {
      this.cameraPermission = 'unsupported';
      this.cameraError = 'Este navegador no permite solicitar acceso a la cámara.';
      return;
    }

    this.cameraLoading = true;
    this.cameraError = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      this.cameraPermission = 'granted';
    } catch (error: unknown) {
      const errorName = error instanceof DOMException ? error.name : '';
      this.cameraPermission = errorName === 'NotAllowedError' ? 'denied' : 'unknown';
      this.cameraError = errorName === 'NotAllowedError'
        ? 'No se concedió el permiso. Revisa los permisos del sitio en tu navegador.'
        : errorName === 'NotFoundError'
          ? 'No se encontró una cámara disponible en este dispositivo.'
          : 'No se pudo acceder a la cámara. Comprueba que el sitio use HTTPS y vuelve a intentarlo.';
    } finally {
      this.cameraLoading = false;
      this.cargarEstadoPermisos();
      this.cdr.detectChanges();
    }
  }

  get pushSupported(): boolean {
    return this.notificationsService.isPushAvailable;
  }

  private async cargarEstadoBiometria(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user?.email || !isPlatformBrowser(this.platformId)) return;
    try {
      this.biometriaDisponible = await this.webAuthn.disponible();
      const state = await firstValueFrom(this.webAuthn.estado(user.email));
      this.biometriaRegistrada = Boolean(state.biometric_enabled);
      this.biometriaCredencialExistente = Boolean(state.tiene_credenciales);
    } catch (error) {
      console.error('No se pudo consultar el estado biométrico:', error);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async cambiarBiometria(): Promise<void> {
    const user = this.authService.getCurrentUser();
    const token = this.authService.getToken();
    if (!user || !token || this.biometriaLoading) return;

    this.biometriaLoading = true;
    try {
      if (this.biometriaRegistrada) {
        await firstValueFrom(this.authService.actualizarBiometria(user.id, false));
        this.biometriaRegistrada = false;
        if (isPlatformBrowser(this.platformId)) localStorage.removeItem('sk_biometric_registered');
        this.showToast('Biometría desactivada para esta cuenta.', 'success');
      } else if (this.biometriaCredencialExistente) {
        await firstValueFrom(this.authService.actualizarBiometria(user.id, true));
        this.biometriaRegistrada = true;
        if (isPlatformBrowser(this.platformId)) localStorage.setItem('sk_biometric_registered', 'true');
        this.showToast('Biometría activada nuevamente.', 'success');
      } else {
        const options = await firstValueFrom(this.webAuthn.opcionesRegistro(token));
        const credential = await this.webAuthn.crearCredencial(options.options);
        const deviceLabel = this.dispositivoService.detectarModelo();
        await firstValueFrom(this.webAuthn.verificarRegistro(token, credential, deviceLabel));
        this.biometriaRegistrada = true;
        this.biometriaCredencialExistente = true;
        this.webAuthn.marcarRegistrada();
        this.showToast('Biometría activada para este dispositivo.', 'success');
      }
    } catch (error: unknown) {
      const message = error instanceof HttpErrorResponse
        ? error.error?.error
        : error instanceof Error ? error.message : '';
      this.showToast(message || 'No se pudo actualizar la biometría.', 'error');
    } finally {
      this.biometriaLoading = false;
      this.cdr.detectChanges();
    }
  }

  // ── Helpers de vista ───────────────────────────────────
  get nombreCompleto(): string {
    return `${this.usuario.nombre} ${this.usuario.apellido}`.trim();
  }

  get ultimoAccesoFormateado(): string {
    if (!this.usuario.ultimo_login) {
      return 'Sin registros';
    }
    try {
      const date = new Date(this.usuario.ultimo_login);
      if (isNaN(date.getTime())) {
        return 'Sin registros';
      }
      return date.toLocaleString('es-MX', {
        dateStyle: 'medium', 
        timeStyle: 'short'
      });
    } catch (error) {
      return 'Sin registros';
    }
  }

  get miembroDesdeFormateado(): string {
    if (!this.usuario.created_at) return '';
    try {
      const date = new Date(this.usuario.created_at);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('es-MX', {
        year: 'numeric', 
        month: 'long'
      });
    } catch (error) {
      return '';
    }
  }
}