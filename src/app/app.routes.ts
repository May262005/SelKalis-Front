// app.routes.ts
import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { LoginComponent } from './auth/login/login.component';
import { RegistroComponent } from './auth/registro/registro.component';
import { RecuperarComponent } from './pages/auth/recuperar.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TratamientosComponent } from './pages/medicamentos/tratamientos.component';
import { CitasComponent } from './pages/citas/citas.component';
import { EstudiosComponent } from './pages/estudios/estudios.component';
import { DocumentosComponent } from './pages/documentos/documentos.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { AdminComponent } from './pages/admin/admin.component';
import { authGuard } from './guards/auth.guard';

// IMPORTAR LOS COMPONENTES LEGALES
import { TerminosComponent } from './pages/legal/terminos/terminos.component';
import { PrivacidadComponent } from './pages/legal/privacidad/privacidad.component';
import { AvisoLegalComponent } from './pages/legal/aviso-legal/aviso-legal.component';
import { ProteccionDatosComponent } from './pages/legal/proteccion-datos/proteccion-datos.component';
import { CookiesComponent } from './pages/legal/cookies/cookies.component';

// IMPORTAR LOS COMPONENTES DE SOPORTE
import { AyudaComponent } from './pages/legal/ayuda/ayuda.component';
import { FaqComponent } from './pages/legal/faq/faq.component';

export const routes: Routes = [
  // Páginas públicas
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'recuperar', component: RecuperarComponent },
  
  // PÁGINAS LEGALES (públicas, sin autenticación)
  { path: 'terminos', component: TerminosComponent },
  { path: 'privacidad', component: PrivacidadComponent },
  { path: 'aviso-legal', component: AvisoLegalComponent },
  { path: 'proteccion-datos', component: ProteccionDatosComponent },
  { path: 'cookies', component: CookiesComponent },
  
  // PÁGINAS DE SOPORTE (públicas, sin autenticación)
  { path: 'ayuda', component: AyudaComponent },
  { path: 'faq', component: FaqComponent },
  
  // Páginas protegidas (requieren autenticación)
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'tratamientos', component: TratamientosComponent, canActivate: [authGuard] },
  { path: 'citas', component: CitasComponent, canActivate: [authGuard] },
  { path: 'estudios', component: EstudiosComponent, canActivate: [authGuard] },
  { path: 'documentos', component: DocumentosComponent, canActivate: [authGuard] },
  { path: 'perfil', component: PerfilComponent, canActivate: [authGuard] },
  { path: 'admin', component: AdminComponent, canActivate: [authGuard] },
  // Redirección para rutas no encontradas
  { path: '**', redirectTo: '' }
];