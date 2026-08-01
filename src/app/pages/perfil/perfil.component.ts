import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
  private apiUrl = 'http://localhost:3000/api';

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
    private http: HttpClient,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.usuario = {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido ?? '',
        email: user.email,
        telefono: user.telefono ?? '',
        created_at: user.created_at ?? '',
        ultimo_login: user.ultimo_login ?? ''
      };
      this.usuarioEdit = { ...this.usuario };

      this.http.get<any>(`${this.apiUrl}/usuarios/${user.id}`, {
        headers: this.authService.getAuthHeaders()
      }).subscribe({
        next: (res) => {
          if (res.user) {
            this.usuario = { ...this.usuario, ...res.user };
            this.usuarioEdit = { ...this.usuario };
            this.cdr.detectChanges();
          }
        },
        error: () => this.showToast('No se pudo cargar la información del perfil', 'warning')
      });
    }

    const savedPrefs = localStorage.getItem('preferencias');
    if (savedPrefs) this.preferencias = JSON.parse(savedPrefs);
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

    this.http.put<any>(`${this.apiUrl}/usuarios/${id}`,
      { nombre, apellido, telefono },
      { headers: this.authService.getAuthHeaders() }
    ).subscribe({
      next: (res) => {
        if (res.user) {
          this.usuario = { ...this.usuario, ...res.user };
          this.usuarioEdit = { ...this.usuario };
        }
        this.isLoadingGuardar = false;
        this.cerrarModalEditar();
        this.showToast('Perfil actualizado correctamente', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingGuardar = false;
        const msg = err.error?.error ?? 'Error al actualizar el perfil';
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

    this.http.post<any>(`${this.apiUrl}/usuarios/login`, {
      email: this.usuario.email,
      password: this.passwordVerificacion
    }).subscribe({
      next: () => {
        this.passwordDescifrada = this.passwordVerificacion;
        this.isLoadingVerificar = false;
        this.cerrarModalVerificar();
        this.abrirPasswordModal();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingVerificar = false;
        this.showToast('Contraseña incorrecta', 'error');
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

    this.http.post<any>(`${this.apiUrl}/usuarios/cambiar-password`, {
      userId: this.usuario.id,
      currentPassword: this.passwords.actual,
      newPassword: this.passwords.nueva
    }, { headers: this.authService.getAuthHeaders() }).subscribe({
      next: () => {
        this.isLoadingCambiarPassword = false;
        this.cerrarModalCambiarPassword();
        this.showToast('Contraseña cambiada correctamente', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingCambiarPassword = false;
        const msg = err.error?.error ?? 'Error al cambiar la contraseña';
        this.showToast(msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ── Preferencias ───────────────────────────────────────
  togglePreferencia(pref: 'email' | 'push') {
    this.preferencias[pref] = !this.preferencias[pref];
    localStorage.setItem('preferencias', JSON.stringify(this.preferencias));
  }

  // ── Helpers de vista ───────────────────────────────────
  get nombreCompleto(): string {
    return `${this.usuario.nombre} ${this.usuario.apellido}`.trim();
  }

  get ultimoAccesoFormateado(): string {
    if (!this.usuario.ultimo_login) return 'Sin registros';
    return new Date(this.usuario.ultimo_login).toLocaleString('es-MX', {
      dateStyle: 'medium', timeStyle: 'short'
    });
  }

  get miembroDesdeFormateado(): string {
    if (!this.usuario.created_at) return '';
    return new Date(this.usuario.created_at).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'long'
    });
  }
}