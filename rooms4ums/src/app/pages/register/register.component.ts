import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="register-page">
      <div class="register-box win-panel">
        <h2 class="win-title">ALTA DE NUEVO USUARIO</h2>
        
        <form (ngSubmit)="onSubmit()" #registerForm="ngForm" class="register-form">
          <div class="form-grid">
            <div class="form-group">
              <label>NOMBRE DE USUARIO (*)</label>
              <input type="text" name="username" [(ngModel)]="formData.username" 
                     class="win-input" required placeholder="Ej: terminal_user_01" />
            </div>

            <div class="form-group">
              <label>CORREO ELECTRÓNICO (*)</label>
              <input type="email" name="email" [(ngModel)]="formData.email" 
                     class="win-input" required placeholder="correo@ejemplo.com" />
            </div>

            <div class="form-group">
              <label>FECHA DE NACIMIENTO (*)</label>
              <input type="date" name="birth_date" [(ngModel)]="formData.birth_date" 
                     class="win-input" required />
            </div>

            <div class="form-group">
              <label>PAÍS DE ORIGEN (*)</label>
              <select name="country" [(ngModel)]="formData.country" class="win-input" required>
                <option value="" disabled selected>Seleccione un país...</option>
                <option value="MX">MÉXICO</option>
                <option value="US">ESTADOS UNIDOS</option>
                <option value="ES">ESPAÑA</option>
                <option value="CO">COLOMBIA</option>
                <option value="AR">ARGENTINA</option>
                <option value="CL">CHILE</option>
                <option value="OTHER">OTRO</option>
              </select>
            </div>

            <div class="form-group full-width">
              <label>CONTRASEÑA (*)</label>
              <div class="password-wrapper">
                <input [type]="isPasswordVisible ? 'text' : 'password'" 
                       name="password" 
                       [(ngModel)]="formData.password" 
                       (input)="onPasswordInput()"
                       class="win-input" 
                       required 
                       placeholder="********" />
                
                <button type="button" class="toggle-password" (click)="togglePassword()">
                  <i class="bi" [class.bi-eye-slash]="isPasswordVisible" [class.bi-eye]="!isPasswordVisible"></i>
                </button>
              </div>
              
              <div class="password-checkers">
                <span [class.valid]="checks.length">● +12 CARACTERES</span>
                <span [class.valid]="checks.symbol">● 1 SÍMBOLO</span>
                <span [class.valid]="checks.upper">● 1 MAYÚSCULA</span>
              </div>
            </div>
          </div>

          <div class="actions">
            <button type="submit" class="win-button primary" 
                    [disabled]="!registerForm.valid || !isPasswordSecure()">
              CREAR CUENTA
            </button>
            <button type="button" class="win-button" (click)="goBack()">VOLVER</button>
          </div>
        </form>

        <p class="login-link">
          ¿YA TIENE UNA CUENTA? <a routerLink="/login">ACCEDA DESDE AQUÍ</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .register-page { display: flex; justify-content: center; align-items: center; min-height: 80vh; padding: 20px; }
    .register-box { width: 600px; padding: 40px; }
    .win-title { margin-bottom: 35px; display: block; text-align: center; font-size: 1.5rem; }
    .register-form { display: flex; flex-direction: column; gap: 20px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .full-width { grid-column: span 2; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    label { font-size: 0.7rem; color: var(--accent-color); font-weight: bold; }
    .win-input { background-color: #000; border: 1px solid var(--win-border-light); color: var(--accent-color); padding: 12px; outline: none; width: 100%; font-family: monospace; }
    .password-wrapper { position: relative; display: flex; align-items: center; width: 100%; }
    .toggle-password { position: absolute; right: 10px; background: none; border: none; color: var(--accent-color); cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; }
    .password-checkers { display: flex; gap: 15px; margin-top: 10px; font-size: 0.6rem; color: #555; }
    .password-checkers .valid { color: #00ff00; font-weight: bold; }
    .actions { display: flex; gap: 15px; margin-top: 20px; }
    .win-button { flex: 1; }
    .win-button.primary { background: var(--accent-color); color: #000; }
    .win-button:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(1); }
    .login-link { margin-top: 30px; font-size: 0.7rem; text-align: center; }
    a { color: var(--accent-color); font-weight: bold; text-decoration: none; }
    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } .full-width { grid-column: span 1; } .register-box { width: 100%; } }
  `]
})
export class RegisterComponent {
  private location = inject(Location);
  private router = inject(Router);
  private ns = inject(NotificationService);
  private authService = inject(AuthService);

  formData = {
    username: '',
    email: '',
    password: '',
    birth_date: '',
    country: ''
  };

  isPasswordVisible = false;

  checks = {
    length: false,
    symbol: false,
    upper: false
  };

  togglePassword() {
    this.isPasswordVisible = !this.isPasswordVisible;
  }

  onPasswordInput() {
    const p = this.formData.password || '';
    this.checks.length = p.length >= 12;
    this.checks.symbol = /[!@#$%^&*(),.?":{}|<>]/.test(p);
    this.checks.upper = /[A-Z]/.test(p);
  }

  isPasswordSecure(): boolean {
    return this.checks.length && this.checks.symbol && this.checks.upper;
  }

  async onSubmit() {
    try {
      this.ns.show('PROCESANDO REGISTRO...', 'info');
      await this.authService.register(this.formData);
      this.ns.show('CUENTA CREADA EXITOSAMENTE', 'success');
      
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 1500);
    } catch (e: any) {
      console.error('[REGISTER_COMPONENT] Error:', e);
      const errorMsg = e.error?.message || 'ERROR AL CREAR LA CUENTA';
      this.ns.show(errorMsg.toUpperCase(), 'error');
    }
  }

  goBack() {
    this.location.back();
  }
}
