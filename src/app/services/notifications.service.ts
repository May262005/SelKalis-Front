import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom, Observable, take } from 'rxjs';
import { AuthService } from './auth.service';

export type NotificationType = 'medicamento' | 'cita' | 'soporte';

export interface NotificationPreferences {
  push_enabled: boolean;
  medicamentos_enabled: boolean;
  citas_enabled: boolean;
  soporte_enabled: boolean;
  timezone: string;
}

export interface AppNotification {
  id: string;
  tipo: NotificationType;
  titulo: string;
  mensaje: string;
  datos: { url?: string; [key: string]: unknown };
  created_at: string;
  read_at: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly swPush = inject(SwPush);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = 'https://selkalis-soporte-service.onrender.com';

  readonly pushMessages$ = this.swPush.messages;

  get isPushAvailable(): boolean {
    return isPlatformBrowser(this.platformId) && this.swPush.isEnabled;
  }

  getPreferences(): Observable<ApiResponse<NotificationPreferences>> {
    return this.http.get<ApiResponse<NotificationPreferences>>(
      `${this.apiUrl}/notifications/preferences`,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  updatePreferences(preferences: Partial<NotificationPreferences>): Observable<ApiResponse<NotificationPreferences>> {
    return this.http.put<ApiResponse<NotificationPreferences>>(
      `${this.apiUrl}/notifications/preferences`,
      preferences,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  getNotifications(): Observable<ApiResponse<AppNotification[]>> {
    return this.http.get<ApiResponse<AppNotification[]>>(
      `${this.apiUrl}/notifications`,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  markAsRead(id: string): Observable<ApiResponse<AppNotification>> {
    return this.http.patch<ApiResponse<AppNotification>>(
      `${this.apiUrl}/notifications/${encodeURIComponent(id)}/read`,
      {},
      { headers: this.auth.getAuthHeaders() }
    );
  }

  markAllAsRead(): Observable<{ success: boolean }> {
    return this.http.patch<{ success: boolean }>(
      `${this.apiUrl}/notifications/read-all`,
      {},
      { headers: this.auth.getAuthHeaders() }
    );
  }

  async enablePush(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Las notificaciones solo se pueden configurar desde el navegador.');
    }

    if (!('Notification' in window)) {
      throw new Error('Este navegador no permite notificaciones.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error(permission === 'denied'
        ? 'Las notificaciones están bloqueadas en los ajustes del navegador.'
        : 'No se concedió el permiso de notificaciones.');
    }

    if (!this.swPush.isEnabled) {
      throw new Error('Permiso concedido, pero las notificaciones push requieren HTTPS y el service worker activo de la PWA.');
    }

    const config = await firstValueFrom(this.http.get<ApiResponse<{
      pushAvailable: boolean;
      publicKey: string;
    }>>(`${this.apiUrl}/notifications/config`, {
      headers: this.auth.getAuthHeaders()
    }));

    if (!config.data.pushAvailable || !config.data.publicKey) {
      throw new Error('El servicio de notificaciones push aún no está configurado.');
    }

    let subscription = await firstValueFrom(this.swPush.subscription.pipe(take(1)));
    if (!subscription) {
      subscription = await this.swPush.requestSubscription({
        serverPublicKey: config.data.publicKey
      });
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';
    await this.persistSubscription(subscription, timezone);
  }

  async restoreCurrentDeviceSubscription(): Promise<void> {
    if (!this.isPushAvailable || !this.auth.isTokenValid()) return;

    const subscription = await firstValueFrom(this.swPush.subscription.pipe(take(1)));
    if (!subscription) return;

    const preferences = await firstValueFrom(this.getPreferences());
    if (!preferences.data.push_enabled) return;

    await this.persistSubscription(subscription, preferences.data.timezone);
  }

  async removeCurrentDeviceSubscription(): Promise<void> {
    if (!this.isPushAvailable || !this.auth.isTokenValid()) return;

    const subscription = await firstValueFrom(this.swPush.subscription.pipe(take(1)));
    if (!subscription) return;

    await firstValueFrom(this.http.delete(
      `${this.apiUrl}/notifications/subscriptions`,
      {
        headers: this.auth.getAuthHeaders(),
        body: { endpoint: subscription.endpoint }
      }
    ));
  }

  async disablePush(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const subscription = this.swPush.isEnabled
      ? await firstValueFrom(this.swPush.subscription.pipe(take(1)))
      : null;

    await firstValueFrom(this.http.delete(
      `${this.apiUrl}/notifications/subscriptions`,
      {
        headers: this.auth.getAuthHeaders(),
        body: {}
      }
    ));

    if (subscription) {
      const unsubscribed = await subscription.unsubscribe();
      if (!unsubscribed) throw new Error('El navegador no pudo cancelar la suscripción push.');
    }
  }

  private async persistSubscription(subscription: PushSubscription, timezone: string): Promise<void> {
    await firstValueFrom(this.http.post(
      `${this.apiUrl}/notifications/subscriptions`,
      { subscription: subscription.toJSON(), timezone },
      { headers: this.auth.getAuthHeaders() }
    ));
  }
}
