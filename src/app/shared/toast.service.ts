import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  show(message: string, type: ToastType = 'info'): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.timeoutId) clearTimeout(this.timeoutId);
    document.getElementById('selkalis-toast')?.remove();

    const iconMap: Record<ToastType, string> = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.id = 'selkalis-toast';
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
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
    container.style.cssText = 'display:flex;align-items:center;gap:16px;';

    const icon = document.createElement('i');
    icon.className = `fas ${iconMap[type]}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = 'font-size:28px;color:#4A6FA5;flex-shrink:0;width:32px;text-align:center;';

    const text = document.createElement('span');
    text.textContent = message;
    text.style.cssText = 'font-size:16px;font-weight:500;color:#1F3A5F;line-height:1.5;word-break:break-word;';

    container.append(icon, text);
    toast.appendChild(container);
    document.body.appendChild(toast);
    toast.offsetHeight;

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    this.timeoutId = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-100px)';
      setTimeout(() => toast.remove(), 400);
      this.timeoutId = null;
    }, 4000);
  }
}
