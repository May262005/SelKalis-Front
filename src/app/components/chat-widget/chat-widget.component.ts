import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, SoporteService } from '../../services/soporte.service';
import { groupChatMessagesByDay } from '../../shared/chat-message-groups';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-widget.component.html',
  styleUrl: './chat-widget.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatWidgetComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly soporte = inject(SoporteService);
  private readonly auth = inject(AuthService);

  private readonly usuarioActual = toSignal(this.auth.currentUser$, {
    initialValue: this.auth.getCurrentUser()
  });
  readonly mostrarWidget = computed(() =>
    !!this.usuarioActual() && this.usuarioActual()?.rol !== 'admin'
  );
  readonly usuarioId = computed(() => this.usuarioActual()?.id ?? '');
  readonly abierto = signal(false);
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly mostrarGuia = signal(false);
  readonly mensajes = signal<ChatMessage[]>([]);
  readonly gruposPorDia = computed(() => groupChatMessagesByDay(this.mensajes()));

  readonly form = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.maxLength(1000)]]
  });

  private pollingSubscription: Subscription | null = null;
  private readonly pollingIntervalMs = 15000;
  private usuarioConversacionKey = this.identidadUsuario(this.auth.getCurrentUser());

  constructor() {
    this.auth.currentUser$.pipe(takeUntilDestroyed()).subscribe(user => {
      const identity = this.identidadUsuario(user);
      if (identity === this.usuarioConversacionKey) return;

      this.usuarioConversacionKey = identity;
      this.detenerPolling();
      this.abierto.set(false);
      this.cargando.set(false);
      this.enviando.set(false);
      this.mensajes.set([]);
      this.form.reset();
      this.aviso.set('');
      this.error.set('');
    });
  }

  toggle(): void {
    this.abierto.update(open => !open);
    if (this.abierto()) {
      this.cargarMensajes();
      this.iniciarPolling();
    } else {
      this.detenerPolling();
    }
  }

  ngOnDestroy(): void {
    this.detenerPolling();
  }

  toggleGuia(): void {
    this.mostrarGuia.update(visible => !visible);
  }

  usarPregunta(pregunta: string): void {
    this.form.controls.mensaje.setValue(pregunta);
    this.form.controls.mensaje.markAsTouched();
  }

  esRespuestaAutomatica(message: ChatMessage): boolean {
    return message.sender_role === 'admin' && message.mensaje.startsWith('Respuesta automática: ');
  }

  contenidoMensaje(message: ChatMessage): string {
    return this.esRespuestaAutomatica(message)
      ? message.mensaje.slice('Respuesta automática: '.length)
      : message.mensaje;
  }

  enviar(): void {
    const mensaje = this.form.controls.mensaje.value.trim();
    if (!mensaje || this.form.invalid || this.enviando()) {
      this.form.controls.mensaje.markAsTouched();
      return;
    }

    const requestUserIdentity = this.identidadUsuario(this.usuarioActual());
    this.enviando.set(true);
    this.error.set('');
    this.soporte.sendChatMessage(mensaje).subscribe({
      next: newMessages => {
        if (this.identidadUsuario(this.usuarioActual()) !== requestUserIdentity) return;
        const messages = this.combinarMensajes(this.mensajes(), newMessages);
        this.mensajes.set(messages);
        this.actualizarAvisoSeguimiento(messages);
        this.form.reset();
        this.enviando.set(false);
      },
      error: error => {
        if (this.identidadUsuario(this.usuarioActual()) === requestUserIdentity) this.manejarError(error);
      }
    });
  }

  private cargarMensajes(): void {
    if (this.cargando() || this.enviando()) return;

    const requestUserIdentity = this.identidadUsuario(this.usuarioActual());
    this.cargando.set(true);
    this.error.set('');
    this.soporte.getChatMessages().subscribe({
      next: messages => {
        if (this.identidadUsuario(this.usuarioActual()) !== requestUserIdentity) return;
        const mergedMessages = this.combinarMensajes(this.mensajes(), messages);
        this.mensajes.set(mergedMessages);
        this.actualizarAvisoSeguimiento(mergedMessages);
        this.cargando.set(false);
      },
      error: error => {
        if (this.identidadUsuario(this.usuarioActual()) === requestUserIdentity) this.manejarError(error);
      }
    });
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

  private actualizarAvisoSeguimiento(messages: ChatMessage[]): void {
    const ultimoMensaje = messages[messages.length - 1];
    this.aviso.set(
      ultimoMensaje?.sender_role === 'user'
        ? 'Tu consulta quedó en espera de respuesta del equipo de soporte.'
        : ''
    );
  }

  private identidadUsuario(user: { id: string; rol?: string } | null): string {
    return user ? `${user.id}:${user.rol ?? 'user'}` : '';
  }

  private iniciarPolling(): void {
    if (this.pollingSubscription) return;
    this.pollingSubscription = interval(this.pollingIntervalMs).subscribe(() => this.cargarMensajes());
  }

  private detenerPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = null;
  }

  private combinarMensajes(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    const messages = new Map<string, ChatMessage>();
    for (const message of [...existing, ...incoming]) messages.set(message.id, message);
    return Array.from(messages.values()).sort((first, second) =>
      first.created_at.localeCompare(second.created_at)
    );
  }
}
