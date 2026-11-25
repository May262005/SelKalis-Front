import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MenuService } from '../menu.service';
import { AuthService } from '../../services/auth.service';
import { NotificationsService } from '../../services/notifications.service';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-mobile-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './mobile-menu.component.html',
  styleUrls: ['./mobile-menu.component.css']
})
export class MobileMenuComponent implements OnInit {
  isOpen = false;
  user: any = null;
  userInitials: string = 'U';
  esAdmin: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private router: Router,
    private menuService: MenuService,
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private toast: ToastService
  ) {
    this.menuService.isOpen.subscribe(open => {
      this.isOpen = open;
      if (isPlatformBrowser(this.platformId)) {
        document.body.style.overflow = open ? 'hidden' : '';
      }
    });
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.user = this.authService.getCurrentUser();
      if (this.user) {
        this.userInitials = this.user.nombre.charAt(0).toUpperCase();
        this.esAdmin = this.user.rol === 'admin';
      }

      this.authService.currentUser$.subscribe(user => {
        this.user = user;
        if (user) {
          this.userInitials = user.nombre.charAt(0).toUpperCase();
          this.esAdmin = user.rol === 'admin';
        } else {
          this.esAdmin = false;
        }
      });
    }
  }

  closeMenu() { this.menuService.close(); }

  async cerrarSesion(): Promise<void> {
    try {
      await this.notificationsService.removeCurrentDeviceSubscription();
    } catch (error) {
      console.error('No se pudo desactivar push en este dispositivo antes del cierre de sesión:', error);
      this.toast.show('No se pudo desactivar push en este dispositivo. Revisa tu conexión e inténtalo de nuevo.', 'error');
      return;
    }

    this.authService.logout();
    this.closeMenu();
    this.router.navigate(['/']);
  }
}