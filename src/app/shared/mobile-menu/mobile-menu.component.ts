import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MenuService } from '../menu.service';
import { AuthService } from '../../services/auth.service';

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

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private router: Router,
    private menuService: MenuService,
    private authService: AuthService
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
      }
      
      this.authService.currentUser$.subscribe(user => {
        this.user = user;
        if (user) {
          this.userInitials = user.nombre.charAt(0).toUpperCase();
        }
      });
    }
  }

  closeMenu() { this.menuService.close(); }

  cerrarSesion() {
    this.authService.logout();
    this.closeMenu();
    this.router.navigate(['/']);
  }
}