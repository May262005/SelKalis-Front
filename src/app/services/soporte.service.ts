import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export type TicketStatus = 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado';
export type TicketCategory =
  | 'tecnica'
  | 'cuenta'
  | 'citas'
  | 'estudios'
  | 'tratamientos'
  | 'documentos'
  | 'otro';
export type SupportRole = 'user' | 'admin';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: SupportRole;
  mensaje: string;
  created_at: string;
}

export interface SupportConversation {
  id: string;
  usuario_id: string;
  nombre: string;
  email: string;
  ultimo_mensaje: string | null;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  usuario_id: string;
  nombre_solicitante: string;
  email_solicitante: string;
  asunto: string;
  categoria: TicketCategory;
  descripcion: string;
  estado: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface TicketReply {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: SupportRole;
  mensaje: string;
  created_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

const TOKEN_KEY = 'sk_token';

@Injectable({ providedIn: 'root' })
export class SoporteService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://selkalis-soporte-service.onrender.com';

  private headers(): HttpHeaders {
    const token = localStorage.getItem(TOKEN_KEY);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
  }

  getChatMessages(): Observable<ChatMessage[]> {
    return this.http.get<ApiResponse<ChatMessage[]>>(
      `${this.apiUrl}/chat/mensajes`,
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  sendChatMessage(mensaje: string): Observable<ChatMessage[]> {
    return this.http.post<ApiResponse<ChatMessage[]>>(
      `${this.apiUrl}/chat/mensajes`,
      { mensaje },
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  getConversations(): Observable<SupportConversation[]> {
    return this.http.get<ApiResponse<SupportConversation[]>>(
      `${this.apiUrl}/admin/conversaciones`,
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  getConversationMessages(conversationId: string): Observable<ChatMessage[]> {
    return this.http.get<ApiResponse<ChatMessage[]>>(
      `${this.apiUrl}/admin/conversaciones/${conversationId}/mensajes`,
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  sendAdminChatMessage(conversationId: string, mensaje: string): Observable<ChatMessage> {
    return this.http.post<ApiResponse<ChatMessage>>(
      `${this.apiUrl}/admin/conversaciones/${conversationId}/mensajes`,
      { mensaje },
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  getTickets(): Observable<SupportTicket[]> {
    return this.http.get<ApiResponse<SupportTicket[]>>(
      `${this.apiUrl}/tickets`,
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  createTicket(ticket: {
    asunto: string;
    categoria: TicketCategory;
    descripcion: string;
  }): Observable<SupportTicket> {
    return this.http.post<ApiResponse<SupportTicket>>(
      `${this.apiUrl}/tickets`,
      ticket,
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  updateTicketStatus(id: string, estado: TicketStatus): Observable<SupportTicket> {
    return this.http.patch<ApiResponse<SupportTicket>>(
      `${this.apiUrl}/tickets/${id}`,
      { estado },
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  getTicketReplies(ticketId: string): Observable<TicketReply[]> {
    return this.http.get<ApiResponse<TicketReply[]>>(
      `${this.apiUrl}/tickets/${ticketId}/respuestas`,
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }

  sendTicketReply(ticketId: string, mensaje: string): Observable<TicketReply> {
    return this.http.post<ApiResponse<TicketReply>>(
      `${this.apiUrl}/tickets/${ticketId}/respuestas`,
      { mensaje },
      { headers: this.headers() }
    ).pipe(map(response => response.data));
  }
}
