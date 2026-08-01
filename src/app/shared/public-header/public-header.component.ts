import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-header.component.html',
  styleUrls: ['./public-header.component.css']
})
export class PublicHeaderComponent {
  showAuthButtons: boolean = true;

  constructor(private router: Router) {
    this.router.events.subscribe(() => {
      const url = this.router.url;
      // Páginas donde NO se muestran los botones de autenticación (login/registro)
      const authPages = ['/login', '/registro', '/recuperar'];
      
      // Páginas públicas donde SÍ se muestran los botones
      const publicPages = [
        '/', 
        '/terminos', 
        '/privacidad', 
        '/aviso-legal', 
        '/proteccion-datos', 
        '/cookies',
        '/ayuda', 
        '/faq', 
        '/contacto'
      ];
      
      // Mostrar botones solo en páginas públicas que NO son de autenticación
      this.showAuthButtons = publicPages.some(page => url === page) && 
                           !authPages.some(page => url === page);
    });
  }

  goToLanding() {
    this.router.navigate(['/']);
  }
}