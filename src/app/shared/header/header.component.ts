import { Component, OnInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MenuService } from '../menu.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  iniciales: string = 'U';
  nombreUsuario: string = 'Usuario';
  menuAbierto: boolean = false;

  constructor(
    private router: Router,
    public menuService: MenuService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const user = this.authService.getCurrentUser();
      if (user) {
        this.nombreUsuario = user.nombre;
        this.iniciales = user.nombre.charAt(0).toUpperCase();
      }
      
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.nombreUsuario = user.nombre;
          this.iniciales = user.nombre.charAt(0).toUpperCase();
        }
      });
    }
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