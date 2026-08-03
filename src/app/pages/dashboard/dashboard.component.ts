import { Component, OnInit, Inject, PLATFORM_ID, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DashboardService, DashboardData } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  nombreUsuario: string = '';
  fechaActual: string = '';
  horaActual: string = '';
  saludo: string = '';
  isLoading: boolean = true;
  private intervalId: any = null;
  
  proximaToma: { nombre: string; hora: string } | null = null;
  proximaCita: { doctor: string; fecha: string; hora?: string } | null = null;
  tratamientosActivos: number = 0;
  completadosHoy: number = 0;
  
  tratamientosActivosLista: any[] = [];
  proximasCitas: any[] = [];
  proximosEstudios: any[] = [];
  documentosRecientes: any[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private authService: AuthService,
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.authService.tokenReady$.subscribe((ready: boolean) => {
      if (ready) {
        this.cargarUsuario();
        this.cargarDashboard();
        this.cdr.detectChanges();
      }
    });

    const user = this.authService.getCurrentUser();
    if (user) {
      this.nombreUsuario = user.nombre;
      this.cargarDashboard();
      this.cdr.detectChanges();
    }

    this.actualizarFechaHora();
    this.cdr.detectChanges();
    
    this.intervalId = setInterval(() => {
      this.actualizarFechaHora();
      this.cdr.detectChanges();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  cargarUsuario() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.nombreUsuario = user.nombre;
      this.cdr.detectChanges();
    }
  }

  actualizarFechaHora() {
    const ahora = new Date();
    
    const opcionesFecha: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    };
    this.fechaActual = ahora.toLocaleDateString('es-ES', opcionesFecha);
    
    const opcionesHora: Intl.DateTimeFormatOptions = { 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    this.horaActual = ahora.toLocaleTimeString('es-ES', opcionesHora);
    
    const hora = ahora.getHours();
    if (hora >= 5 && hora < 12) {
      this.saludo = 'Buenos dias';
    } else if (hora >= 12 && hora < 19) {
      this.saludo = 'Buenas tardes';
    } else {
      this.saludo = 'Buenas noches';
    }
  }

  cargarDashboard() {
    const token = this.authService.getToken();
    if (!token) {
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    
    this.dashboardService.getDashboardData().subscribe({
      next: (data: DashboardData) => {
        this.isLoading = false;
        
        this.proximaToma = data.proximaToma;
        this.proximaCita = data.proximaCita;
        this.tratamientosActivos = data.totalTratamientosActivos;
        this.completadosHoy = data.tomasCompletadasHoy;
        
        this.tratamientosActivosLista = data.tratamientosActivos;
        this.proximasCitas = data.proximaCita ? [data.proximaCita] : [];
        this.proximosEstudios = data.proximosEstudios;
        this.documentosRecientes = data.documentosRecientes;
        
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        this.isLoading = false;
        console.error('❌ Error cargando dashboard:', error);
        this.cdr.detectChanges();
      }
    });
  }

  subirDocumento() {
    window.location.href = '/documentos';
  }

  verDocumento(doc: any) {
    if (doc.url) {
      window.open(doc.url, '_blank');
    } else {
      alert('Abriendo: ' + doc.nombre);
    }
  }
}