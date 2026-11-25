import { Component, OnInit, Inject, PLATFORM_ID, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { DashboardService, DashboardData } from '../../services/dashboard.service';
import { WebAuthnService } from '../../services/webauthn.service';
import { DispositivoService } from '../../services/dispositivo.service';

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

  biometriaDisponible = false;
  biometriaRegistrada = false;
  cargandoBiometria = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private authService: AuthService,
    private dashboardService: DashboardService,
    private cdr: ChangeDetectorRef,
    private webAuthn: WebAuthnService,
    private dispositivoService: DispositivoService
  ) {}

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.biometriaDisponible = await this.webAuthn.disponible();
      this.biometriaRegistrada = this.webAuthn.estaRegistrada();
    }

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

  async activarBiometriaDesdeDashboard() {
    const token = this.authService.getToken();
    if (!token) return;

    this.cargandoBiometria = true;
    this.cdr.detectChanges();
    try {
      const opciones = await this.webAuthn.opcionesRegistro(token).toPromise();
      const credential = await this.webAuthn.crearCredencial(opciones.options);
      const deviceLabel = this.dispositivoService.detectarModelo();
      
      await this.webAuthn.verificarRegistro(token, credential, deviceLabel).toPromise();
      
      this.webAuthn.marcarRegistrada();
      this.biometriaRegistrada = true;
      this.cdr.detectChanges();
      this.showToast('Biometría activada. La próxima vez podrás entrar sin contraseña.', 'success');
    } catch (e: any) {
      this.showToast(e.error?.error || e.message || 'Error al activar biometría', 'error');
    } finally {
      this.cargandoBiometria = false;
      this.cdr.detectChanges();
    }
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const existingToast = document.getElementById('selkalis-toast');
    if (existingToast) existingToast.remove();

    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.id = 'selkalis-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      padding: 18px 32px;
      background: #E8F0FE;
      border-radius: 14px;
      box-shadow: 0 6px 24px rgba(31, 58, 95, 0.18);
      border: 1px solid #B8D4F0;
      font-family: 'Segoe UI', system-ui, sans-serif;
      z-index: 9999;
      max-width: 90vw;
      min-width: 320px;
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
    `;

    const icon = document.createElement('i');
    icon.className = `fas ${iconMap[type]}`;
    icon.style.cssText = `
      font-size: 28px;
      color: #4A6FA5;
      flex-shrink: 0;
      width: 32px;
      text-align: center;
    `;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    textSpan.style.cssText = `
      font-size: 16px;
      font-weight: 500;
      color: #1F3A5F;
      line-height: 1.5;
      word-break: break-word;
    `;

    container.appendChild(icon);
    container.appendChild(textSpan);
    toast.appendChild(container);
    document.body.appendChild(toast);
    toast.offsetHeight;

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-100px)';
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 400);
    }, 4000);
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
    const opcionesFecha: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    this.fechaActual = ahora.toLocaleDateString('es-ES', opcionesFecha);
    const opcionesHora: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    this.horaActual = ahora.toLocaleTimeString('es-ES', opcionesHora);
    
    const hora = ahora.getHours();
    if (hora >= 5 && hora < 12) this.saludo = 'Buenos dias';
    else if (hora >= 12 && hora < 19) this.saludo = 'Buenas tardes';
    else this.saludo = 'Buenas noches';
  }

  cargarDashboard() {
    const token = this.authService.getToken();
    if (!token) return;

    this.isLoading = true;
    this.cdr.detectChanges();
    
    this.dashboardService.getDashboardData().subscribe({
      next: (data: DashboardData) => {
        this.isLoading = false;
        this.proximaToma = data.proximaToma;
        if (data.proximaCita) {
          this.proximaCita = { doctor: data.proximaCita.doctor, fecha: data.proximaCita.fecha, hora: data.proximaCita.hora };
        } else {
          this.proximaCita = null;
        }
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
        this.cargarDatosFallback();
        this.cdr.detectChanges();
      }
    });
  }

  cargarDatosFallback() {
    const tratamientos = localStorage.getItem('tratamientos');
    if (tratamientos) {
      try {
        const data = JSON.parse(tratamientos);
        const activos = data.filter((t: any) => t.estado === 'activo');
        this.tratamientosActivos = activos.length;
        this.tratamientosActivosLista = activos.map((t: any) => ({
          nombre: t.nombre,
          medicamentosCount: t.medicamentos?.length || 0,
          progreso: 0
        }));
        this.cdr.detectChanges();
      } catch (e) {}
    }
  }

  subirDocumento() { window.location.href = '/documentos'; }
  verDocumento(doc: any) {
    if (doc.url) window.open(doc.url, '_blank');
    else this.showToast('Abriendo: ' + doc.nombre, 'info');
  }
}