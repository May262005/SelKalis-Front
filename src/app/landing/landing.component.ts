// landing.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CookieConsentService } from '../services/cookie-consent.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit, OnDestroy {

  featIndex = 0;
  testiIndex = 0;
  private autoplayInterval: any;

  testimonios = [
    {
      texto: 'Antes olvidaba mis medicamentos constantemente. Ahora con SelKalis llevo tres meses sin perder una sola dosis. Es increíblemente simple de usar.',
      iniciales: 'LM',
      nombre: 'Laura Martínez',
      rol: 'Paciente crónica, CDMX'
    },
    {
      texto: 'Llevo el control de mis padres y mis hijos desde la misma app. Tener todos los documentos médicos en un lugar me da una tranquilidad enorme.',
      iniciales: 'CR',
      nombre: 'Carlos Reyes',
      rol: 'Papá de familia, Guadalajara'
    },
    {
      texto: 'Como médica, recomiendo SelKalis a mis pacientes. Llegan a consulta con su historial completo y eso mejora muchísimo la calidad de la atención.',
      iniciales: 'SV',
      nombre: 'Dra. Sofía Vargas',
      rol: 'Médico general, Monterrey'
    }
  ];

  constructor(
    private router: Router,
    private cookieConsentService: CookieConsentService
  ) {}

  ngOnInit(): void {
    this.autoplayInterval = setInterval(() => {
      this.moveTesti(1);
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
    }
  }

  moveFeat(dir: number): void {
    this.featIndex = (this.featIndex + dir + 2) % 2;
  }

  moveTesti(dir: number): void {
    this.testiIndex = (this.testiIndex + dir + this.testimonios.length) % this.testimonios.length;
  }

  goToLanding(): void {
    this.router.navigate(['/']);
  }

  abrirConfiguracionCookies(): void {
    this.cookieConsentService.abrirConfiguracion();
  }
}