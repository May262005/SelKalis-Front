import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarPerfil();
    
    const savedPrefs = localStorage.getItem('preferencias');
    if (savedPrefs) this.preferencias = JSON.parse(savedPrefs);
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
    this.preferencias[pref] = !this.preferencias[pref];
    localStorage.setItem('preferencias', JSON.stringify(this.preferencias));
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