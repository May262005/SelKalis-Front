import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ChatMessage, SoporteService } from '../../services/soporte.service';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-widget.component.html',
  styleUrl: './chat-widget.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatWidgetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly soporte = inject(SoporteService);
  private readonly auth = inject(AuthService);

  readonly esAdmin = this.auth.getCurrentUser()?.rol === 'admin';
  readonly usuarioId = this.auth.getCurrentUser()?.id ?? '';
  readonly abierto = signal(false);
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly mensajes = signal<ChatMessage[]>([]);

  readonly form = this.fb.nonNullable.group({
    mensaje: ['', [Validators.required, Validators.maxLength(1000)]]
  });

  private mensajesCargados = false;

  toggle(): void {
    this.abierto.update(open => !open);
    if (this.abierto() && !this.mensajesCargados) this.cargarMensajes();
  }

  recargar(): void {
    this.cargarMensajes();
  }

  enviar(): void {
    const mensaje = this.form.controls.mensaje.value.trim();
    if (!mensaje || this.form.invalid || this.enviando()) {
      this.form.controls.mensaje.markAsTouched();
      return;
    }

    this.enviando.set(true);
    this.error.set('');
    this.soporte.sendChatMessage(mensaje).subscribe({
      next: message => {
        this.mensajes.update(messages => [...messages, message]);
        this.form.reset();
        this.enviando.set(false);
        this.mensajesCargados = true;
      },
      error: error => this.manejarError(error)
    });
  }

  private cargarMensajes(): void {
    this.cargando.set(true);
    this.error.set('');
    this.soporte.getChatMessages().subscribe({
      next: messages => {
        this.mensajes.set(messages);
        this.mensajesCargados = true;
        this.cargando.set(false);
      },
      error: error => this.manejarError(error)
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
}
