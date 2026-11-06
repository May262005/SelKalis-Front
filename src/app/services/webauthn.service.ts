import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WebAuthnService {
  private apiUrl = 'https://selkalis-auth-service.onrender.com';
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /** ¿El navegador soporta biometría de plataforma? */
  async disponible(): Promise<boolean> {
    if (!this.isBrowser) return false;
    if (!window.PublicKeyCredential) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  /** Pregunta al backend si el email tiene biometría configurada */
  estado(email: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/webauthn/estado/${encodeURIComponent(email)}`);
  }

  /** Pide al backend las opciones de registro */
  opcionesRegistro(token: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/webauthn/registro/opciones`,
      {},
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    );
  }

  /** Envía al backend la credencial creada por el navegador */
  verificarRegistro(token: string, credential: any, deviceLabel: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/webauthn/registro/verificar`,
      { credential, device_label: deviceLabel },
      { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
    );
  }

  /** Pide opciones de login biométrico */
  opcionesLogin(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/webauthn/login/opciones`, { email });
  }

  /** Envía la respuesta del navegador al backend */
  verificarLogin(email: string, credential: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/webauthn/login/verificar`, {
      email,
      credential
    });
  }

  // ==================== HELPERS BASE64URL ====================

  private base64urlToBuffer(base64url: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const buffer = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
    return buffer;
  }

  private bufferToBase64url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /** Crea una credencial WebAuthn con el navegador (huella/FaceID/PIN) */
  async crearCredencial(optionsFromServer: any): Promise<any> {
    if (!this.isBrowser) throw new Error('No disponible en SSR');

    const opts = optionsFromServer;
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: this.base64urlToBuffer(opts.challenge),
      rp: opts.rp,
      user: {
        id: this.base64urlToBuffer(opts.user.id),
        name: opts.user.name,
        displayName: opts.user.displayName
      },
      pubKeyCredParams: opts.pubKeyCredParams,
      timeout: opts.timeout || 60000,
      attestation: opts.attestation || 'none',
      authenticatorSelection: opts.authenticatorSelection || {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      excludeCredentials: (opts.excludeCredentials || []).map((c: any) => ({
        id: this.base64urlToBuffer(c.id),
        type: 'public-key'
      }))
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    })) as PublicKeyCredential;

    if (!credential) throw new Error('No se creó la credencial');

    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.bufferToBase64url(response.clientDataJSON),
        attestationObject: this.bufferToBase64url(response.attestationObject)
      },
      clientExtensionResults: credential.getClientExtensionResults()
    };
  }

  /** Pide al navegador autenticarse con huella/FaceID */
  async obtenerCredencial(optionsFromServer: any): Promise<any> {
    if (!this.isBrowser) throw new Error('No disponible en SSR');

    const opts = optionsFromServer;
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: this.base64urlToBuffer(opts.challenge),
      timeout: opts.timeout || 60000,
      rpId: opts.rpId,
      userVerification: 'required',
      allowCredentials: (opts.allowCredentials || []).map((c: any) => ({
        id: this.base64urlToBuffer(c.id),
        type: 'public-key'
      }))
    };

    const credential = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    })) as PublicKeyCredential;

    if (!credential) throw new Error('No se obtuvo credencial');

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      id: credential.id,
      rawId: this.bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: this.bufferToBase64url(response.clientDataJSON),
        authenticatorData: this.bufferToBase64url(response.authenticatorData),
        signature: this.bufferToBase64url(response.signature),
        userHandle: response.userHandle
          ? this.bufferToBase64url(response.userHandle)
          : null
      },
      clientExtensionResults: credential.getClientExtensionResults()
    };
  }
}