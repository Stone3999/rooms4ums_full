import { Component, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { startAuthentication } from '@simplewebauthn/browser';

type LoginStep = 'identity' | 'auth';
type AuthMethod = 'biometric' | 'password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-box win-panel">
        <h2 class="win-title">SISTEMA DE ACCESO</h2>
        
        <!-- PASO 1: IDENTIFICACIÓN (Solo Correo/Usuario + RRSS) -->
        <div *ngIf="currentStep() === 'identity'" class="step-container">
          <div class="form-group">
            <label>CORREO ELECTRÓNICO O USUARIO:</label>
            <input type="text" [(ngModel)]="identifier" class="win-input" placeholder="ejemplo@rooms4ums.sys" (keyup.enter)="checkUser()" />
          </div>
          <div class="actions">
            <button class="win-button primary" (click)="checkUser()" [disabled]="isLoading()">
              {{ isLoading() ? 'BUSCANDO...' : 'SIGUIENTE' }}
            </button>
            <button class="win-button" (click)="goBack()">CANCELAR</button>
          </div>

          <div class="divider"><span>O ENTRAR CON</span></div>

          <div class="social-actions">
            <button class="win-button social-btn google" title="Google">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C9.03,19.27 6.59,16.74 6.59,13.09C6.59,9.44 9.03,6.91 12.19,6.91C14.12,6.91 15.6,7.75 16.57,8.62L18.62,6.57C17.13,4.89 14.87,3.91 12.19,3.91C7.13,3.91 3,7.91 3,13.09C3,18.27 7.13,22.27 12.19,22.27C17.11,22.27 21.46,18.74 21.46,13.09C21.46,12.4 21.42,11.75 21.35,11.1V11.1Z" /></svg>
            </button>
            <button class="win-button social-btn github" title="GitHub">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21.03C9.5,20.82 9.5,20.24 9.5,19.5C6.73,20.1 6.14,18.15 6.14,18.15C5.69,17 5.05,16.71 5.05,16.71C4.14,16.09 5.12,16.1 5.12,16.1C6.12,16.17 6.65,17.12 6.65,17.12C7.54,18.65 8.97,18.21 9.54,17.95C9.63,17.31 9.88,16.87 10.16,16.62C7.95,16.33 5.62,15.47 5.62,11.62C5.62,10.52 6,9.62 6.63,8.92C6.52,8.65 6.17,7.62 6.73,6.23C6.73,6.23 7.58,5.96 9.5,7.25C10.3,7.03 11.15,6.92 12,6.92C12.85,6.92 13.7,7.03 14.5,7.25C16.42,5.96 17.27,6.23 17.27,6.23C17.83,7.62 17.48,8.65 17.37,8.92C18,9.62 18.38,10.52 18.38,11.62C18.38,15.48 16.05,16.32 13.83,16.57C14.19,16.76 14.5,17.13 14.5,17.7C14.5,18.5 14.5,19.17 14.5,19.37C14.5,19.61 14.66,19.9 15.17,19.81C19.14,18.48 22,14.73 22,12A10,10 0 0,0 12,2Z" /></svg>
            </button>
          </div>
        </div>

        <!-- PASO 2: AUTENTICACIÓN (Huella o Password) -->
        <div *ngIf="currentStep() === 'auth'" class="step-container">
          <div class="user-chip">
            <i class="pixelart-icons-font-user"></i>
            <div class="chip-info">
              <span class="chip-name">{{identifier}}</span>
              <button class="back-link" (click)="resetLogin()">Cambiar cuenta</button>
            </div>
          </div>

          <!-- Opción A: Biometría (Si está activa) -->
          <div *ngIf="currentAuthMethod() === 'biometric'" class="biometric-area">
            <div class="scanner-box" (click)="!isLoading() && startBiometricScan()" [class.clickable]="!isLoading()">
              <i class="bi bi-fingerprint" [class.pulse]="isLoading()"></i>
              <p>{{ isLoading() ? 'VERIFICANDO...' : 'CLIC PARA ESCANEAR' }}</p>
            </div>
            <p class="status-text">{{biometricStatus()}}</p>
            <div class="actions vertical">
              <button class="win-button primary" (click)="startBiometricScan()" [disabled]="isLoading()">
                REINTENTAR HUELLA
              </button>
              <button class="win-button" (click)="switchAuthMethod('password')" [disabled]="isLoading()">
                USAR CONTRASEÑA
              </button>
            </div>
          </div>

          <!-- Opción B: Contraseña (Fallback) -->
          <div *ngIf="currentAuthMethod() === 'password'" class="password-area">
            <div class="form-group">
              <label>CONTRASEÑA:</label>
              <div class="password-wrapper">
                <input [type]="isPasswordVisible() ? 'text' : 'password'" [(ngModel)]="password" class="win-input" autofocus (keyup.enter)="loginWithPassword()" />
                <button type="button" class="toggle-password" (click)="togglePassword()">
                  <i class="bi" [class.bi-eye-slash]="isPasswordVisible()" [class.bi-eye]="!isPasswordVisible()"></i>
                </button>
              </div>
            </div>
            <div class="actions">
              <button class="win-button primary" (click)="loginWithPassword()" [disabled]="isLoading()">
                {{ isLoading() ? 'ENTRANDO...' : 'ENTRAR' }}
              </button>
              <button class="win-button" (click)="switchAuthMethod('biometric')" *ngIf="userHasBiometrics()">VOLVER A HUELLA</button>
            </div>
          </div>
        </div>

        <p class="register-link" *ngIf="currentStep() === 'identity'">
          ¿NUEVO EN EL SISTEMA? <a routerLink="/register">REGISTRARSE</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-page { display: flex; justify-content: center; align-items: center; height: 70vh; }
    .login-box { width: 400px; padding: 30px; }
    .win-title { margin-bottom: 30px; display: block; text-align: center; }
    
    .form-group { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 0.75rem; color: var(--accent-color); font-weight: bold; }
    .win-input { background-color: #000; border: 1px solid var(--win-border-light); color: var(--accent-color); padding: 12px; outline: none; width: 100%; font-family: monospace; }
    
    .password-wrapper { position: relative; display: flex; align-items: center; width: 100%; }
    .toggle-password { position: absolute; right: 10px; background: none; border: none; color: var(--accent-color); cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; }

    .actions { display: flex; gap: 10px; margin-top: 20px; }
    .actions.vertical { flex-direction: column; }
    .win-button { width: 100%; }
    .win-button.primary { background: var(--accent-color); color: #000; }
    .win-button:disabled { opacity: 0.5; cursor: not-allowed; }
    
    /* SOCIAL */
    .divider { margin: 30px 0; text-align: center; border-bottom: 1px dashed var(--win-border-dark); line-height: 0.1em; }
    .divider span { background: #000; padding: 0 10px; font-size: 0.6rem; color: var(--text-secondary); }
    .social-actions { display: flex; justify-content: center; gap: 15px; }
    .social-btn { width: 45px; height: 45px; padding: 0 !important; display: flex; align-items: center; justify-content: center; }

    /* AUTH STEP */
    .user-chip { display: flex; align-items: center; gap: 12px; background: #0a0a0a; padding: 10px; border: 1px solid var(--win-border-dark); margin-bottom: 25px; }
    .user-chip i { font-size: 1.5rem; color: var(--accent-color); }
    .chip-name { display: block; font-size: 0.85rem; font-weight: bold; color: white; }
    .back-link { background: none; border: none; color: var(--accent-color); font-size: 0.7rem; cursor: pointer; padding: 0; text-decoration: underline; }
    
    .biometric-area { text-align: center; display: flex; flex-direction: column; gap: 15px; }
    .scanner-box { padding: 25px; border: 1px dashed var(--accent-color); margin-bottom: 10px; }
    .scanner-box.clickable { cursor: pointer; }
    .scanner-box.clickable:hover { background: #111; }
    .scanner-box i { font-size: 2.5rem; color: var(--accent-color); display: block; margin-bottom: 10px; }
    .pulse { animation: pulse 1.5s infinite; }
    .status-text { font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 10px; }
    
    @keyframes pulse { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
    .register-link { margin-top: 30px; font-size: 0.7rem; text-align: center; }
    a { color: var(--accent-color); font-weight: bold; text-decoration: none; }
  `]
})
export class LoginComponent {
  private location = inject(Location);
  private authService = inject(AuthService);
  private router = inject(Router);
  private ns = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);

  currentStep = signal<LoginStep>('identity');
  currentAuthMethod = signal<AuthMethod>('password');
  userHasBiometrics = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  biometricStatus = signal<string>('Esperando sensor...');
  isPasswordVisible = signal<boolean>(false);

  identifier = '';
  password = '';

  togglePassword() {
    this.isPasswordVisible.set(!this.isPasswordVisible());
  }

  async checkUser() {
    if (!this.identifier) return;
    
    this.isLoading.set(true);
    try {
      const response = await this.authService.checkUser(this.identifier);
      this.userHasBiometrics.set(response.hasBiometrics);
      
      if (response.hasBiometrics) {
        this.currentAuthMethod.set('biometric');
        this.currentStep.set('auth');
        setTimeout(() => this.startBiometricScan(), 500);
      } else {
        this.currentAuthMethod.set('password');
        this.currentStep.set('auth');
      }
    } catch (error: any) {
      console.error('[LOGIN] Error checkUser:', error);
      this.ns.show('USUARIO NO ENCONTRADO', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loginWithPassword() {
    if (!this.password) return;

    this.isLoading.set(true);
    try {
      const response = await this.authService.login({
        identifier: this.identifier,
        password: this.password
      });
      this.ns.show('BIENVENIDO AL SISTEMA', 'success');
      this.router.navigate(['/home']);
    } catch (error: any) {
      console.error('[LOGIN] Error login:', error);
      const msg = error.error?.message || 'CONTRASEÑA INCORRECTA';
      this.ns.show(msg.toUpperCase(), 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  async startBiometricScan() {
    this.biometricStatus.set('Coloca tu huella en el sensor...');
    this.isLoading.set(true);
    
    try {
      const options: any = await this.authService.generateAuthenticationOptions(this.identifier);
      const authResponse = await startAuthentication({ optionsJSON: options });
      const result: any = await this.authService.verifyAuthentication(this.identifier, authResponse, options.challenge);

      if (result.verified) {
        this.ns.show('IDENTIDAD BIOMÉTRICA CONFIRMADA', 'success');
        this.router.navigate(['/home']);
      } else {
        throw new Error('Fallo en verificación');
      }
    } catch (error: any) {
      console.error('[LOGIN] Error biométrico:', error);
      this.biometricStatus.set('Error en escaneo.');
      
      if (error.name === 'NotAllowedError') {
        this.ns.show('OPERACIÓN CANCELADA', 'warn');
      } else {
        this.ns.show('FALLO BIOMÉTRICO. PUEDES REINTENTAR.', 'error');
      }
      // Ya no forzamos el cambio a password aquí para permitir reintentar
    } finally {
      this.isLoading.set(false);
    }
  }

  switchAuthMethod(method: AuthMethod) {
    this.currentAuthMethod.set(method);
  }

  resetLogin() {
    this.currentStep.set('identity');
    this.password = '';
  }

  goBack() {
    this.location.back();
  }
}
