import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface DashboardData {
  proximaToma: { nombre: string; hora: string } | null;
  proximaCita: { 
    doctor: string; 
    fecha: string; 
    hora?: string;
    fechaCorta?: string;  // ✅ Agregar propiedad opcional
    tipo?: string;        // ✅ Agregar propiedad opcional
  } | null;
  totalTratamientosActivos: number;
  tomasCompletadasHoy: number;
  tratamientosActivos: any[];
  proximosEstudios: any[];
  documentosRecientes: any[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = 'https://selkalis-auth-service.onrender.com';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // ✅ Formatear fecha desde 'YYYY-MM-DD'
  private formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return 'No programada';
    
    try {
      const parts = fecha.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        
        const date = new Date(year, month, day);
        return date.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
      
      const date = new Date(fecha);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
      
      return fecha;
    } catch (error) {
      console.warn('Error formateando fecha:', fecha, error);
      return fecha || 'No programada';
    }
  }

  // ✅ Formatear fecha corta
  private formatearFechaCorta(fecha: string | null | undefined): string {
    if (!fecha) return '';
    
    try {
      const parts = fecha.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[2]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[0]);
        return `${day}/${month}/${year}`;
      }
      return fecha;
    } catch {
      return fecha || '';
    }
  }

  // ✅ Formatear hora desde 'HH:MM:SS'
  private formatearHora(hora: string | null | undefined): string {
    if (!hora) return '';
    
    try {
      const parts = hora.split(':');
      if (parts.length >= 2) {
        const hour = parseInt(parts[0]);
        const minute = parseInt(parts[1]);
        
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
      }
      
      return hora;
    } catch (error) {
      console.warn('Error formateando hora:', hora, error);
      return hora || '';
    }
  }

  getDashboardData(): Observable<DashboardData> {
    const token = this.authService.getToken();
    if (!token) {
      return throwError(() => new Error('No hay token de autenticación'));
    }

    const headers = this.authService.getAuthHeaders();

    return this.http.get<any>(`${this.apiUrl}/dashboard`, { headers }).pipe(
      map((response) => {
        console.log('📥 Respuesta del servidor:', response);
        
        // ✅ Procesar próximos estudios
        const proximosEstudios = (response.proximosEstudios || []).map((estudio: any) => ({
          ...estudio,
          fechaFormateada: this.formatearFecha(estudio.fecha_programada || estudio.fecha),
          fechaCorta: this.formatearFechaCorta(estudio.fecha_programada || estudio.fecha),
          horaFormateada: this.formatearHora(estudio.hora_time || estudio.hora)
        }));

        // ✅ Procesar próxima cita - SIN propiedades adicionales
        let proximaCita = null;
        if (response.proximaCita) {
          proximaCita = {
            doctor: response.proximaCita.doctor || 'Doctor',
            fecha: this.formatearFecha(response.proximaCita.fecha_programada || response.proximaCita.fecha),
            hora: this.formatearHora(response.proximaCita.hora_time || response.proximaCita.hora)
            // ❌ Eliminamos fechaCorta y tipo para que coincida con la interfaz
          };
        }

        const dashboardData: DashboardData = {
          proximaToma: response.proximaToma ? {
            nombre: response.proximaToma.nombre || 'Medicamento',
            hora: this.formatearHora(response.proximaToma.hora)
          } : null,
          
          proximaCita: proximaCita,
          
          totalTratamientosActivos: response.totalTratamientosActivos || 0,
          tomasCompletadasHoy: response.tomasCompletadasHoy || 0,
          tratamientosActivos: response.tratamientosActivos || [],
          proximosEstudios: proximosEstudios,
          documentosRecientes: response.documentosRecientes || []
        };
        
        console.log('📊 Dashboard procesado:', dashboardData);
        return dashboardData;
      }),
      catchError((error) => {
        console.error('❌ Error al obtener datos del dashboard:', error);
        return throwError(() => error);
      })
    );
  }
}