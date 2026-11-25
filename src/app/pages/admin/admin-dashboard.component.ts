import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AdminService, Usuario } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { SoporteService, SupportTicket, TicketStatus } from '../../services/soporte.service';
import { WebAuthnService } from '../../services/webauthn.service';
import { DispositivoService } from '../../services/dispositivo.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  usuarios: Usuario[] = [];
  tickets: SupportTicket[] = [];

  cargandoUsuarios = true;
  cargandoTickets = true;

  errorUsuarios = '';
  errorTickets = '';

  biometriaDisponible = false;
  biometriaRegistrada = false;
  cargandoBiometria = false;
  biometriaAviso = '';
  biometriaError = '';

  constructor(
    private adminService: AdminService,
    private soporteService: SoporteService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: object,
    private authService: AuthService,
    private webAuthn: WebAuthnService,
    private dispositivoService: DispositivoService
  ) {}

  async ngOnInit(): Promise<void> {
    this.cargarDatos();
    if (!isPlatformBrowser(this.platformId)) return;

    this.biometriaDisponible = await this.webAuthn.disponible();
    this.biometriaRegistrada = this.webAuthn.estaRegistrada();
    this.cdr.detectChanges();
  }

  async activarBiometriaDesdeDashboard(): Promise<void> {
    const token = this.authService.getToken();
    if (!token) {
      this.biometriaError = 'No se encontró una sesión activa. Vuelve a iniciar sesión e inténtalo de nuevo.';
      return;
    }

    this.cargandoBiometria = true;
    this.biometriaAviso = '';
    this.biometriaError = '';
    this.cdr.detectChanges();

    try {
      const opciones = await firstValueFrom(this.webAuthn.opcionesRegistro(token));
      const credential = await this.webAuthn.crearCredencial(opciones.options);
      const deviceLabel = this.dispositivoService.detectarModelo();

      await firstValueFrom(this.webAuthn.verificarRegistro(token, credential, deviceLabel));
      this.webAuthn.marcarRegistrada();
      this.biometriaRegistrada = true;
      this.biometriaAviso = 'Biometría activada. La próxima vez podrás entrar sin contraseña.';
    } catch (error: unknown) {
      this.biometriaError = this.errorBiometria(error);
    } finally {
      this.cargandoBiometria = false;
      this.cdr.detectChanges();
    }
  }

  get usuariosActivos(): number {
    return this.usuarios.filter(usuario => usuario.activo).length;
  }

  get incidenciasPendientes(): number {
    return this.tickets.filter(ticket =>
      ticket.estado === 'abierto' || ticket.estado === 'en_proceso'
    ).length;
  }

  get incidenciasEnProceso(): number {
    return this.tickets.filter(ticket => ticket.estado === 'en_proceso').length;
  }

  get incidenciasResueltas(): number {
    return this.tickets.filter(ticket =>
      ticket.estado === 'resuelto' || ticket.estado === 'cerrado'
    ).length;
  }

  get incidenciasRecientes(): SupportTicket[] {
    return [...this.tickets]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }

  get resumenEstados(): Array<{
    estado: TicketStatus;
    etiqueta: string;
    total: number;
    porcentaje: number;
  }> {
    const estados: Array<{ estado: TicketStatus; etiqueta: string }> = [
      { estado: 'abierto', etiqueta: 'Abiertas' },
      { estado: 'en_proceso', etiqueta: 'En proceso' },
      { estado: 'resuelto', etiqueta: 'Resueltas' },
      { estado: 'cerrado', etiqueta: 'Cerradas' }
    ];

    return estados.map(item => {
      const total = this.tickets.filter(ticket => ticket.estado === item.estado).length;
      return {
        ...item,
        total,
        porcentaje: this.tickets.length ? (total / this.tickets.length) * 100 : 0
      };
    });
  }

  cargarDatos(): void {
    this.cargandoUsuarios = true;
    this.cargandoTickets = true;
    this.errorUsuarios = '';
    this.errorTickets = '';
    this.cdr.detectChanges();

    this.adminService.getUsuarios().subscribe({
      next: usuarios => {
        this.usuarios = usuarios;
        this.cargandoUsuarios = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.errorUsuarios = error?.message || 'No se pudieron cargar los usuarios.';
        this.cargandoUsuarios = false;
        this.cdr.detectChanges();
      }
    });

    this.soporteService.getTickets().subscribe({
      next: tickets => {
        this.tickets = tickets;
        this.cargandoTickets = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.errorTickets = error?.error?.error || error?.message || 'No se pudieron cargar las incidencias.';
        this.cargandoTickets = false;
        this.cdr.detectChanges();
      }
    });
  }

  nombreCategoria(categoria: SupportTicket['categoria']): string {
    const etiquetas: Record<SupportTicket['categoria'], string> = {
      tecnica: 'Soporte técnico',
      cuenta: 'Cuenta y acceso',
      citas: 'Citas',
      estudios: 'Estudios y resultados',
      tratamientos: 'Tratamientos',
      documentos: 'Documentos',
      otro: 'Otro'
    };
    return etiquetas[categoria];
  }

  nombreEstado(estado: TicketStatus): string {
    const etiquetas: Record<TicketStatus, string> = {
      abierto: 'Abierta',
      en_proceso: 'En proceso',
      resuelto: 'Resuelta',
      cerrado: 'Cerrada'
    };
    return etiquetas[estado];
  }

  formatoFecha(fecha: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(fecha));
  }

  private errorBiometria(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.error || error.message || 'Error al activar biometría.';
    }
    return error instanceof Error && error.message
      ? error.message
      : 'Error al activar biometría.';
  }
}
