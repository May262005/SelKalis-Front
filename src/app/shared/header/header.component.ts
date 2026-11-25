import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MenuService } from '../menu.service';
import { AuthService } from '../../services/auth.service';
import { AppNotification, NotificationsService } from '../../services/notifications.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  iniciales: string = 'U';
  nombreUsuario: string = 'Usuario';
  menuAbierto: boolean = false;
  esAdmin: boolean = false;
  notificationsOpen = false;
  notifications: AppNotification[] = [];
  setupNoticeVisible = false;
  private currentUserId: string | null = null;
  private readonly subscriptions = new Subscription();
  private notificationPoll: ReturnType<typeof setInterval> | null = null;

  constructor(
    private router: Router,
    public menuService: MenuService,
    private authService: AuthService,
    private notificationsService: NotificationsService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.subscriptions.add(this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.nombreUsuario = user.nombre;
          this.iniciales = user.nombre.charAt(0).toUpperCase();
          this.esAdmin = user.rol === 'admin';
          this.currentUserId = user.id;
          this.setupNoticeVisible = !localStorage.getItem(`sk_permission_setup_seen:${user.id}`);
          this.cargarNotificaciones();
          if (!this.notificationPoll) {
            this.notificationPoll = setInterval(() => this.cargarNotificaciones(), 45000);
          }
        } else {
          this.esAdmin = false;
          this.currentUserId = null;
          this.setupNoticeVisible = false;
          this.notifications = [];
          if (this.notificationPoll) {
            clearInterval(this.notificationPoll);
            this.notificationPoll = null;
          }
        }
      }));
      this.subscriptions.add(this.notificationsService.pushMessages$.subscribe(() => {
        if (this.currentUserId) this.cargarNotificaciones();
      }));
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.notificationPoll) clearInterval(this.notificationPoll);
  }

  get unreadCount(): number {
    return this.notifications.filter(notification => !notification.read_at).length;
  }

  toggleNotifications(): void {
    this.notificationsOpen = !this.notificationsOpen;
    if (this.notificationsOpen) this.cargarNotificaciones();
  }

  cargarNotificaciones(): void {
    this.notificationsService.getNotifications().subscribe({
      next: response => this.notifications = response.data || [],
      error: error => console.error('No se pudieron cargar las notificaciones:', error)
    });
  }

  abrirNotificacion(notification: AppNotification): void {
    if (!notification.read_at) {
      notification.read_at = new Date().toISOString();
      this.notificationsService.markAsRead(notification.id).subscribe({
        error: error => console.error('No se pudo marcar la notificación como leída:', error)
      });
    }

    this.notificationsOpen = false;
    const url = notification.datos?.url;
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
      void this.router.navigateByUrl(url);
    }
  }

  marcarTodasLeidas(): void {
    this.notificationsService.markAllAsRead().subscribe({
      next: () => {
        const readAt = new Date().toISOString();
        this.notifications = this.notifications.map(notification => ({ ...notification, read_at: readAt }));
      },
      error: error => console.error('No se pudieron marcar todas como leídas:', error)
    });
  }

  configurarPermisos(): void {
    this.descartarAvisoConfiguracion();
    void this.router.navigate(['/perfil']);
  }

  descartarAvisoConfiguracion(): void {
    if (this.currentUserId) {
      localStorage.setItem(`sk_permission_setup_seen:${this.currentUserId}`, 'true');
    }
    this.setupNoticeVisible = false;
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  cerrarMenu() {
    this.menuAbierto = false;
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.menuAbierto = false;
    }
  }

  cerrarSesion() {
    this.menuAbierto = false;
    this.authService.logout();
  }

  goToLanding() {
    this.router.navigate(['/']);
  }
}