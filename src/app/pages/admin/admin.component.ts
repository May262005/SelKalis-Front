// admin/admin.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService, Usuario } from '../../services/admin.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  // Estados de carga
  loading = false;
  error: string | null = null;
  success: string | null = null;

  // Datos
  usuarios: Usuario[] = [];
  usuarioSeleccionado: Usuario | null = null;

  // Filtros
  filtroTexto = '';
  filtroRol: string = 'todos';
  filtroEstado: string = 'todos';

  // Paginación
  paginaActual = 1;
  itemsPorPagina = 10;

  // Modal
  modalAbierto = false;
  modalTipo: 'crear' | 'editar' | 'detalle' | 'confirmar' = 'crear';

  // Formulario
  usuarioForm!: FormGroup;

  // Confirmación
  confirmacionAccion: 'suspender' | 'activar' | 'eliminar' | null = null;
  confirmacionId: string | null = null;
  confirmacionNombre: string = '';

  // Actualización automática
  private refreshInterval: any;

  constructor(
    private adminService: AdminService,
    private fb: FormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarUsuarios();

    // Refrescar cada 30 segundos
    this.refreshInterval = setInterval(() => {
      this.cargarUsuarios();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  // Inicializar formulario
  initForm(): void {
    this.usuarioForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellido: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: [''],
      password: ['', [Validators.minLength(6)]],
      rol: ['user', [Validators.required]]
    });
  }

  // Cargar usuarios
  cargarUsuarios(): void {
    this.loading = true;
    this.error = null;

    this.adminService.getUsuarios().subscribe({
      next: (data: Usuario[]) => {
        this.usuarios = data;
        this.loading = false;
      },
      error: (err: { message: string; }) => {
        this.error = err.message || 'Error al cargar usuarios';
        this.loading = false;
        this.showToast(this.error, 'error');
      }
    });
  }

  // Usuarios filtrados
  get usuariosFiltrados(): Usuario[] {
    let filtrados = this.usuarios;

    // Filtro por texto
    if (this.filtroTexto) {
      const texto = this.filtroTexto.toLowerCase();
      filtrados = filtrados.filter(u =>
        u.nombre.toLowerCase().includes(texto) ||
        u.apellido.toLowerCase().includes(texto) ||
        u.email.toLowerCase().includes(texto)
      );
    }

    // Filtro por rol
    if (this.filtroRol !== 'todos') {
      filtrados = filtrados.filter(u => u.rol === this.filtroRol);
    }

    // Filtro por estado
    if (this.filtroEstado !== 'todos') {
      const activo = this.filtroEstado === 'activo';
      filtrados = filtrados.filter(u => u.activo === activo);
    }

    return filtrados;
  }

  // Usuarios paginados
  get usuariosPaginados(): Usuario[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.usuariosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.usuariosFiltrados.length / this.itemsPorPagina);
  }

  get totalUsuarios(): number {
    return this.usuariosFiltrados.length;
  }

  // Cambiar página
  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  // Abrir modal
  abrirModal(tipo: 'crear' | 'editar' | 'detalle', usuario?: Usuario): void {
    this.modalTipo = tipo;
    this.error = null;
    this.success = null;

    if (tipo === 'crear') {
      this.usuarioForm.reset({
        rol: 'user',
        password: ''
      });
      this.usuarioForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    } else if (tipo === 'editar' && usuario) {
      this.usuarioSeleccionado = usuario;
      this.usuarioForm.patchValue({
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
        telefono: usuario.telefono || '',
        rol: usuario.rol
      });
      this.usuarioForm.get('password')?.clearValidators();
      this.usuarioForm.get('password')?.setValidators([Validators.minLength(6)]);
    } else if (tipo === 'detalle' && usuario) {
      this.usuarioSeleccionado = usuario;
    }

    this.modalAbierto = true;
    this.usuarioForm.updateValueAndValidity();
  }

  // Cerrar modal
  cerrarModal(): void {
    this.modalAbierto = false;
    this.usuarioSeleccionado = null;
    this.error = null;
    this.success = null;
  }

  // Guardar usuario
  guardarUsuario(): void {
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;

    const data = this.usuarioForm.value;

    if (this.modalTipo === 'crear') {
      this.adminService.crearUsuario(data).subscribe({
        next: () => {
          this.success = 'Usuario creado exitosamente';
          this.loading = false;
          this.showToast(this.success, 'success');
          setTimeout(() => {
            this.cerrarModal();
            this.cargarUsuarios();
          }, 1500);
        },
        error: (err: { message: string; }) => {
          this.error = err.message || 'Error al crear usuario';
          this.loading = false;
          this.showToast(this.error, 'error');
        }
      });
    } else if (this.modalTipo === 'editar' && this.usuarioSeleccionado) {
      const updateData: any = {
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono,
        rol: data.rol
      };

      if (data.password) {
        // Si se proporcionó contraseña, el backend la actualizará
        // Pero necesitamos un endpoint separado para cambiar contraseña
        // Por ahora solo actualizamos los datos básicos
      }

      this.adminService.actualizarUsuario(this.usuarioSeleccionado.id, updateData).subscribe({
        next: () => {
          this.success = 'Usuario actualizado exitosamente';
          this.loading = false;
          this.showToast(this.success, 'success');
          setTimeout(() => {
            this.cerrarModal();
            this.cargarUsuarios();
          }, 1500);
        },
        error: (err: { message: string; }) => {
          this.error = err.message || 'Error al actualizar usuario';
          this.loading = false;
          this.showToast(this.error, 'error');
        }
      });
    }
  }

  // Abrir confirmación
  abrirConfirmacion(accion: 'suspender' | 'activar' | 'eliminar', usuario: Usuario): void {
    this.confirmacionAccion = accion;
    this.confirmacionId = usuario.id;
    this.confirmacionNombre = `${usuario.nombre} ${usuario.apellido}`;
    this.modalTipo = 'confirmar';
    this.modalAbierto = true;
  }

  // Ejecutar acción confirmada
  ejecutarConfirmacion(): void {
    if (!this.confirmacionId || !this.confirmacionAccion) return;

    this.loading = true;
    this.error = null;

    const accion = this.confirmacionAccion;
    const id = this.confirmacionId;

    const handler = {
      suspender: () => this.adminService.suspenderUsuario(id),
      activar: () => this.adminService.activarUsuario(id),
      eliminar: () => this.adminService.eliminarUsuario(id)
    };

    handler[accion]().subscribe({
      next: () => {
        const mensajes = {
          suspender: 'Usuario suspendido exitosamente',
          activar: 'Usuario activado exitosamente',
          eliminar: 'Usuario eliminado exitosamente'
        };
        this.success = mensajes[accion];
        this.loading = false;
        this.showToast(this.success, 'success');
        setTimeout(() => {
          this.cerrarModal();
          this.cargarUsuarios();
          this.confirmacionAccion = null;
          this.confirmacionId = null;
        }, 1500);
      },
      error: (err: { message: string; }) => {
        this.error = err.message || 'Error al ejecutar acción';
        this.loading = false;
        this.showToast(this.error, 'error');
      }
    });
  }

  // Verificar si es admin
  esAdmin(usuario: Usuario): boolean {
    return usuario.rol === 'admin';
  }

  // Obtener clase de estado
  getEstadoClass(activo: boolean): string {
    return activo ? 'estado-activo' : 'estado-inactivo';
  }

  getEstadoTexto(activo: boolean): string {
    return activo ? 'Activo' : 'Suspendido';
  }

  // Obtener clase de rol
  getRolClass(rol: string): string {
    return rol === 'admin' ? 'rol-admin' : 'rol-user';
  }

  getRolTexto(rol: string): string {
    return rol === 'admin' ? 'Administrador' : 'Usuario';
  }

  // Formatear fecha
  // Acepta string | null | undefined porque usuario.ultimo_login puede venir null (usuario que nunca inició sesión)
  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return 'Nunca';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Toast flotante (mismo estilo que citas.component.ts)
  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
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

  // Salir
  logout(): void {
    localStorage.removeItem('sk_token');
    localStorage.removeItem('sk_user_data');
    this.router.navigate(['/login']);
  }
}