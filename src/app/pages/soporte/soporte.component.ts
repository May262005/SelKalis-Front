import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import {
  SupportTicket,
  TicketCategory,
  TicketReply,
  TicketStatus,
  SoporteService
} from '../../services/soporte.service';

@Component({
  selector: 'app-soporte',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './soporte.component.html',
  styleUrl: './soporte.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SoporteComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SoporteService);
  private readonly auth = inject(AuthService);

  readonly usuarioId = this.auth.getCurrentUser()?.id ?? '';
  readonly esAdmin = this.auth.getCurrentUser()?.rol === 'admin';
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly tickets = signal<SupportTicket[]>([]);
  readonly ticketSeleccionado = signal<SupportTicket | null>(null);
  readonly respuestas = signal<TicketReply[]>([]);

  readonly ticketForm = this.fb.nonNullable.group({
    asunto: ['', [Validators.required, Validators.maxLength(120)]],
    categoria: this.fb.nonNullable.control<TicketCategory>('tecnica'),
    descripcion: ['', [Validators.required, Validators.minLength(15), Validators.maxLength(2000)]]
  });
  readonly respuestaForm = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.maxLength(1000)]]
  });

  ngOnInit(): void {
    this.cargarTickets();
  }

  crearTicket(): void {
    if (this.esAdmin) return;
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set('');
    this.service.createTicket({
      ...this.ticketForm.getRawValue(),
      categoria: this.ticketForm.controls.categoria.value
    }).subscribe({
      next: ticket => {
        this.tickets.update(tickets => [ticket, ...tickets]);
        this.ticketForm.reset({ asunto: '', categoria: 'tecnica', descripcion: '' });
        this.ticketSeleccionado.set(ticket);
        this.respuestas.set([]);
        this.aviso.set('Tu reporte quedó registrado.');
        this.enviando.set(false);
      },
      error: error => this.manejarError(error)
    });
  }

  seleccionarTicket(ticket: SupportTicket): void {
    this.ticketSeleccionado.set(ticket);
    this.respuestas.set([]);
    this.cargarRespuestas(ticket);
  }

  actualizarEstado(ticket: SupportTicket, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !this.esEstadoValido(target.value)) return;

    this.service.updateTicketStatus(ticket.id, target.value).subscribe({
      next: updated => {
        this.tickets.update(tickets => tickets.map(item => item.id === updated.id ? updated : item));
        if (this.ticketSeleccionado()?.id === updated.id) this.ticketSeleccionado.set(updated);
        this.aviso.set('Se actualizó el estado del reporte.');
      },
      error: error => this.manejarError(error)
    });
  }

  enviarRespuesta(): void {
    const ticket = this.ticketSeleccionado();
    const mensaje = this.respuestaForm.controls.mensaje.value.trim();
    if (!ticket || !mensaje || this.respuestaForm.invalid) {
      this.respuestaForm.controls.mensaje.markAsTouched();
      return;
    }

    this.enviando.set(true);
    this.service.sendTicketReply(ticket.id, mensaje).subscribe({
      next: reply => {
        this.respuestas.update(replies => [...replies, reply]);
        this.respuestaForm.reset();
        this.enviando.set(false);
        this.aviso.set('Se envió la respuesta.');
      },
      error: error => this.manejarError(error)
    });
  }

  esMensajePropio(id: string): boolean {
    return id === this.usuarioId;
  }

  etiquetaEstado(status: TicketStatus): string {
    return {
      abierto: 'Abierto',
      en_proceso: 'En proceso',
      resuelto: 'Resuelto',
      cerrado: 'Cerrado'
    }[status];
  }

  etiquetaCategoria(category: TicketCategory): string {
    return {
      tecnica: 'Soporte técnico',
      cuenta: 'Cuenta y acceso',
      citas: 'Citas',
      estudios: 'Estudios y resultados',
      tratamientos: 'Tratamientos y medicamentos',
      documentos: 'Documentos',
      otro: 'Otro'
    }[category];
  }

  private cargarTickets(): void {
    this.cargando.set(true);
    this.service.getTickets().subscribe({
      next: tickets => {
        this.tickets.set(tickets);
        this.cargando.set(false);
      },
      error: error => this.manejarError(error)
    });
  }

  private cargarRespuestas(ticket: SupportTicket): void {
    this.service.getTicketReplies(ticket.id).subscribe({
      next: replies => {
        if (this.ticketSeleccionado()?.id === ticket.id) this.respuestas.set(replies);
      },
      error: error => {
        if (this.ticketSeleccionado()?.id === ticket.id) this.manejarError(error);
      }
    });
  }

  private esEstadoValido(value: string): value is TicketStatus {
    return ['abierto', 'en_proceso', 'resuelto', 'cerrado'].includes(value);
  }

  private manejarError(error: unknown): void {
    const response = error as { error?: { error?: string; message?: string }; message?: string };
    this.error.set(
      response.error?.error
      ?? response.error?.message
      ?? response.message
      ?? 'No se pudo completar la operación. Intenta de nuevo.'
    );
    this.cargando.set(false);
    this.enviando.set(false);
  }
}
