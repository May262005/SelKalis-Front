import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { HeaderComponent } from './shared/header/header.component';
import { MobileMenuComponent } from './shared/mobile-menu/mobile-menu.component';
import { PublicHeaderComponent } from './shared/public-header/public-header.component';
import { CookieBannerComponent } from './components/cookie-banner/cookie-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, HeaderComponent, MobileMenuComponent, PublicHeaderComponent, CookieBannerComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit, OnDestroy {
  showProtectedLayout: boolean = false;
  showPublicLayout: boolean = false;
  private routerSubscription!: Subscription;

  constructor(private router: Router) {}

  private updateLayout(url: string) {
    // Páginas protegidas (requieren autenticación)
    const protectedPages = [
      '/dashboard', 
      '/tratamientos', 
      '/citas',
      '/estudios',
      '/documentos', 
      '/perfil'
    ];
    
    // Páginas públicas (sin autenticación)
    const publicPages = [
      '/', 
      '/login', 
      '/registro', 
      '/recuperar',
      // Páginas legales
      '/terminos', 
      '/privacidad', 
      '/aviso-legal', 
      '/proteccion-datos', 
      '/cookies',
      // Páginas de soporte
      '/ayuda', 
      '/faq', 
    ];

    this.showProtectedLayout = protectedPages.some(
      page => url === page || url.startsWith(page + '/') || url.startsWith(page + '?')
    );
    
    this.showPublicLayout = !this.showProtectedLayout && publicPages.some(
      page => url === page || url.startsWith(page + '?')
    );
  }

  ngOnInit() {
    this.updateLayout(this.router.url);

    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateLayout(event.urlAfterRedirects);
    });
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}