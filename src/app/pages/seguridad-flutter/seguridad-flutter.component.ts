import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FlutterBridgeService } from '../../services/flutter-bridge.service';

@Component({
  selector: 'app-seguridad-flutter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seguridad-flutter.component.html',
  styleUrls: ['./seguridad-flutter.component.css']
})
export class SeguridadFlutterComponent implements OnInit {
  @ViewChild('flutterFrame', { static: false })
  flutterFrame?: ElementRef<HTMLIFrameElement>;

  mostrarModal = false;
  cargando = false;

  // Flutter está en public/flutter/, Angular lo sirve en /flutter/index.html
  readonly flutterUrl = '/flutter/index.html';

  private isBrowser: boolean;

  constructor(
    private authService: AuthService,
    private flutterBridge: FlutterBridgeService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    }
  }

  abrirModulo(): void {
    this.mostrarModal = true;
    this.cargando = true;

    setTimeout(() => {
      if (this.flutterFrame?.nativeElement) {
        this.flutterBridge.registrarIframe(this.flutterFrame.nativeElement);
      }
    }, 150);
  }

  cerrarModulo(): void {
    this.mostrarModal = false;
  }

  onIframeLoad(): void {
    this.cargando = false;
  }
}