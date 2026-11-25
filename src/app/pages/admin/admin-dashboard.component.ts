import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService, Usuario } from '../../services/admin.service';
import { SoporteService, SupportTicket, TicketStatus } from '../../services/soporte.service';

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

  constructor(
    private adminService: AdminService,
    private soporteService: SoporteService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
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
    this.cdr.markForCheck();

    this.adminService.getUsuarios().subscribe({
      next: usuarios => {
        this.usuarios = usuarios;
        this.cargandoUsuarios = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorUsuarios = error?.message || 'No se pudieron cargar los usuarios.';
        this.cargandoUsuarios = false;
        this.cdr.markForCheck();
      }
    });

    this.soporteService.getTickets().subscribe({
      next: tickets => {
        this.tickets = tickets;
        this.cargandoTickets = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorTickets = error?.error?.error || error?.message || 'No se pudieron cargar las incidencias.';
        this.cargandoTickets = false;
        this.cdr.markForCheck();
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
}
