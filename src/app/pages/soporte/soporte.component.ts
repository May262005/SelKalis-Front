import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, Observable } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import {
  ChatMessage,
  SupportConversation,
  SupportTicket,
  TicketCategory,
  TicketReply,
  TicketStatus,
  SoporteService
} from '../../services/soporte.service';
import { groupChatMessagesByDay } from '../../shared/chat-message-groups';

type SupportTab = 'chat' | 'tickets';

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
  readonly pestana = signal<SupportTab>('tickets');
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly mensajes = signal<ChatMessage[]>([]);
  readonly gruposMensajes = computed(() => groupChatMessagesByDay(this.mensajes()));
  readonly conversaciones = signal<SupportConversation[]>([]);
  readonly conversacionSeleccionada = signal<SupportConversation | null>(null);
  readonly tickets = signal<SupportTicket[]>([]);
  readonly ticketSeleccionado = signal<SupportTicket | null>(null);
  readonly respuestas = signal<TicketReply[]>([]);

  readonly chatForm = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.maxLength(1000)]]
  });
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
    if (this.esAdmin) {
      this.cargarConversaciones();
    }
  }

  cambiarPestana(tab: SupportTab): void {
    this.pestana.set(tab);
    this.error.set('');
    this.aviso.set('');
  }

  recargar(): void {
    if (!this.esAdmin || this.pestana() === 'tickets') {
      this.cargarTickets();
      const ticket = this.ticketSeleccionado();
      if (ticket) this.cargarRespuestas(ticket);
      return;
    }

    if (this.esAdmin) {
      this.cargarConversaciones();
      const conversacion = this.conversacionSeleccionada();
      if (conversacion) this.cargarMensajesAdmin(conversacion);
    }
  }

  cargarConversaciones(): void {
    this.cargando.set(true);
    this.service.getConversations().subscribe({
      next: conversaciones => {
        this.conversaciones.set(conversaciones.filter(conversacion =>
          !conversacion.ultimo_mensaje?.startsWith('Respuesta automática: ')
          && !conversacion.ultimo_mensaje?.startsWith('Soporte: ')
        ));
        this.cargando.set(false);
      },
      error: error => this.manejarError(error)
    });
  }

  seleccionarConversacion(conversacion: SupportConversation): void {
    this.conversacionSeleccionada.set(conversacion);
    this.mensajes.set([]);
    this.error.set('');
    this.cargarMensajesAdmin(conversacion);
  }

  enviarMensaje(): void {
    const mensaje = this.chatForm.controls.mensaje.value.trim();
    if (!mensaje || this.chatForm.invalid) {
      this.chatForm.controls.mensaje.markAsTouched();
      return;
    }

    const conversacionId = this.esAdmin ? this.conversacionSeleccionada()?.id : null;
    let request: Observable<ChatMessage[]>;
    if (this.esAdmin) {
      if (!conversacionId) return;
      request = this.service.sendAdminChatMessage(conversacionId, mensaje)
        .pipe(map(adminMessage => [adminMessage]));
    } else {
      request = this.service.sendChatMessage(mensaje);
    }

    this.enviando.set(true);
    this.error.set('');
    request.subscribe({
      next: newMessages => {
        if (this.esAdmin && this.conversacionSeleccionada()?.id !== conversacionId) {
          this.enviando.set(false);
          this.cargarConversaciones();
          return;
        }
        this.mensajes.update(messages => [...messages, ...newMessages]);
        this.chatForm.reset();
        this.enviando.set(false);
        if (this.esAdmin) {
          this.conversaciones.update(conversaciones =>
            conversaciones.filter(conversacion => conversacion.id !== conversacionId)
          );
          this.conversacionSeleccionada.set(null);
          this.mensajes.set([]);
          this.aviso.set('La respuesta se envió. El chat volverá a la bandeja si el usuario necesita más ayuda.');
          this.cargarConversaciones();
        }
      },
      error: error => this.manejarError(error)
    });
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

  private cargarMensajesAdmin(conversacion: SupportConversation): void {
    this.cargando.set(true);
    this.service.getConversationMessages(conversacion.id).subscribe({
      next: mensajes => {
        if (this.conversacionSeleccionada()?.id !== conversacion.id) return;
        this.mensajes.set(mensajes.filter(mensaje => !this.esRespuestaAutomatica(mensaje)));
        this.cargando.set(false);
      },
      error: error => {
        if (this.conversacionSeleccionada()?.id === conversacion.id) this.manejarError(error);
      }
    });
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

  private esRespuestaAutomatica(message: ChatMessage): boolean {
    return message.sender_role === 'admin' && message.mensaje.startsWith('Respuesta automática: ');
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
