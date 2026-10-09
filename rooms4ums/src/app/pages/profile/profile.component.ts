import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { startRegistration } from '@simplewebauthn/browser';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-container" *ngIf="user">
      <h1 class="win-title">FICHA DE USUARIO V1.0</h1>

      <div class="profile-layout">
        <!-- VISTA DE PERFIL (READ) -->
        <div class="profile-card win-panel" *ngIf="!isEditing">
          <div class="profile-header">
            <div class="avatar-box">
              <i class="pixelart-icons-font-user"></i>
            </div>
            <div class="header-info">
              <h2 class="username">{{user.username}}</h2>
              <span class="user-role">{{user.role}}</span>
            </div>
          </div>

          <div class="profile-details">
            <div class="detail-row">
              <span class="label">EMAIL:</span>
              <span class="value">{{user.email}}</span>
            </div>
            <div class="detail-row">
              <span class="label">FECHA REGISTRO:</span>
              <span class="value">{{user.created_at | date:'yyyy-MM-dd'}}</span>
            </div>
            <div class="detail-row">
              <span class="label">ESTADO:</span>
              <span class="value status-active">EN LINEA</span>
            </div>
            <div class="detail-row bio">
              <span class="label">BIO:</span>
              <p class="value">{{user.bio || 'Sin biografía definida.'}}</p>
            </div>
          </div>

          <!-- SECCIÓN DE SEGURIDAD AVANZADA -->
          <div class="security-section">
            <h3 class="section-title">SEGURIDAD AVANZADA V2.0</h3>
            <div class="security-grid">
              <div class="security-item win-panel">
                <div class="s-header">
                  <i class="pixelart-icons-font-mail"></i>
                  <span>CORREO RECUPERACIÓN</span>
                </div>
                <div class="s-body">
                  <span class="s-value">{{user.recovery_email || 'NO CONFIGURADO'}}</span>
                  <button class="win-button mini-btn">CONFIGURAR</button>
                </div>
              </div>

              <div class="security-item win-panel">
                <div class="s-header">
                  <i class="pixelart-icons-font-device-phone"></i>
                  <span>TELÉFONO ASOCIADO</span>
                </div>
                <div class="s-body">
                  <span class="s-value">{{user.phone_number || 'NO CONFIGURADO'}}</span>
                  <button class="win-button mini-btn">CONFIGURAR</button>
                </div>
              </div>

              <div class="security-item win-panel">
                <div class="s-header">
                  <i class="bi bi-fingerprint"></i>
                  <span>HUELLA DIGITAL</span>
                </div>
                <div class="s-body">
                  <span class="s-value" [class.status-inactive]="!user.has_biometrics">
                    {{user.has_biometrics ? 'ACTIVO' : 'INACTIVO'}}
                  </span>
                  <button class="win-button mini-btn" (click)="activateBiometrics()" [disabled]="isLoading">
                    {{user.has_biometrics ? 'RE-ACTIVAR' : 'ACTIVAR'}}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="profile-actions">
            <button class="win-button" (click)="toggleEdit()">
              <i class="pixelart-icons-font-edit"></i> EDITAR PERFIL
            </button>
            <button class="win-button delete-btn" (click)="deleteAccount()">
              <i class="pixelart-icons-font-close"></i> DESACTIVAR CUENTA
            </button>
          </div>
        </div>

        <!-- FORMULARIO DE EDICION (UPDATE) -->
        <div class="profile-card win-panel edit-mode" *ngIf="isEditing">
          <div class="panel-header">MODO EDICIÓN: ACTUALIZAR DATOS</div>
          
          <div class="edit-form">
            <div class="input-group">
              <label>NOMBRE DE USUARIO</label>
              <input type="text" [(ngModel)]="editUser.username" class="win-input" />
            </div>
            <div class="input-group">
              <label>CORREO ELECTRÓNICO</label>
              <input type="email" [(ngModel)]="editUser.email" class="win-input" />
            </div>
            <div class="input-group">
              <label>BIOGRAFÍA</label>
              <textarea [(ngModel)]="editUser.bio" class="win-textarea" rows="4"></textarea>
            </div>
          </div>

          <div class="profile-actions">
            <button class="win-button save-btn" (click)="saveChanges()">
              <i class="pixelart-icons-font-check"></i> GUARDAR CAMBIOS
            </button>
            <button class="win-button" (click)="toggleEdit()">
              <i class="pixelart-icons-font-close"></i> CANCELAR
            </button>
          </div>
        </div>

        <!-- BARRA LATERAL DE ESTADISTICAS -->
        <aside class="stats-sidebar">
          <div class="win-panel stats-box">
            <div class="box-title">ACTIVIDAD</div>
            <div class="stat-item">
              <span class="s-label">POSTS:</span>
              <span class="s-value">24</span>
            </div>
            <div class="stat-item">
              <span class="s-label">REACCIONES:</span>
              <span class="s-value">156</span>
            </div>
            <div class="stat-item">
              <span class="s-label">NIVEL:</span>
              <span class="s-value">LEET_USER</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .profile-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
    }
    .profile-layout {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 30px;
      margin-top: 30px;
    }
    .profile-card {
      background-color: #111;
      padding: 30px;
      border: 1px solid var(--win-border-dark);
    }
    .profile-header {
      display: flex;
      align-items: center;
      gap: 30px;
      margin-bottom: 40px;
      border-bottom: 1px solid var(--win-border-dark);
      padding-bottom: 20px;
    }
    .avatar-box {
      width: 100px;
      height: 100px;
      border: 3px solid var(--accent-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      color: var(--accent-color);
      background-color: #000;
    }
    .username {
      font-size: 2rem;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .user-role {
      color: var(--accent-color);
      font-size: 0.8rem;
      font-weight: bold;
      letter-spacing: 1px;
    }
    .profile-details {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .detail-row {
      display: flex;
      gap: 20px;
      font-size: 0.9rem;
    }
    .detail-row .label {
      width: 150px;
      color: var(--accent-color);
      font-weight: bold;
    }
    .detail-row.bio { flex-direction: column; gap: 5px; }
    .status-active { color: #00ff00; }
    .status-inactive { color: #ff0000; }
    .profile-actions {
      margin-top: 40px;
      display: flex;
      gap: 15px;
    }
    .delete-btn { color: #ff0000; border-color: #ff0000; }
    .delete-btn:hover { background-color: #1a0000; }

    /* SEGURIDAD AVANZADA */
    .security-section {
      margin-top: 50px;
      border-top: 2px dashed var(--win-border-dark);
      padding-top: 30px;
    }
    .section-title {
      font-size: 1.2rem;
      color: var(--accent-color);
      margin-bottom: 20px;
      letter-spacing: 3px;
    }
    .security-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .security-item {
      padding: 15px;
      background: #050505;
      border: 1px solid var(--win-border-dark);
    }
    .s-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.7rem;
      color: var(--text-secondary);
      margin-bottom: 10px;
      font-weight: bold;
    }
    .s-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .s-body .s-value {
      font-size: 0.8rem;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mini-btn {
      font-size: 0.6rem !important;
      padding: 5px !important;
      width: fit-content;
    }

    /* EDIT MODE */
    .edit-mode .panel-header {
      background-color: var(--accent-color);
      color: black;
      padding: 8px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .edit-form { display: flex; flex-direction: column; gap: 20px; }
    .input-group { display: flex; flex-direction: column; gap: 8px; }
    .input-group label { font-size: 0.75rem; color: var(--accent-color); font-weight: bold; }
    .win-input, .win-textarea {
      background-color: #000;
      border: 1px solid var(--win-border-light);
      color: var(--text-primary);
      padding: 10px;
      font-family: inherit;
      outline: none;
    }
    .win-input:focus, .win-textarea:focus { border-color: var(--accent-color); }
    .save-btn { border-color: #00ff00; color: #00ff00; }

    /* SIDEBAR */
    .stats-box { padding: 20px; background-color: #111; border: 1px solid var(--win-border-dark); }
    .box-title {
      font-weight: bold;
      color: var(--accent-color);
      border-bottom: 1px solid var(--win-border-dark);
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .stat-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 0.8rem;
    }
    .s-label { color: var(--text-secondary); }
    .s-value { color: var(--accent-color); font-weight: bold; }

    @media (max-width: 800px) {
      .profile-layout { grid-template-columns: 1fr; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  private ns = inject(NotificationService);
  private authService = inject(AuthService);
  
  isEditing = false;
  isLoading = false;
  user: any = null;
  editUser: any = null;

  async ngOnInit() {
    await this.loadProfile();
  }

  async loadProfile() {
    this.isLoading = true;
    try {
      this.user = await this.authService.getProfile();
      this.editUser = { ...this.user };
    } catch (error) {
      this.ns.show('ERROR AL CARGAR PERFIL', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async activateBiometrics() {
    this.isLoading = true;
    this.ns.show('INICIANDO REGISTRO BIOMÉTRICO...', 'info');
    
    try {
      // 1. Obtener opciones del servidor
      const options: any = await this.authService.generateRegistrationOptions();
      
      // 2. Ejecutar escaneo en el navegador
      const regResponse = await startRegistration({
        optionsJSON: options,
      });

      // 3. Verificar en el servidor
      const verification: any = await this.authService.verifyRegistration(regResponse, options.challenge);

      if (verification.verified) {
        this.ns.show('¡HUELLA CONFIGURADA EXITOSAMENTE!', 'success');
        await this.loadProfile(); // Recargar para mostrar "ACTIVO"
      } else {
        throw new Error('Verificación fallida');
      }
    } catch (error: any) {
      console.error('Error en registro biométrico:', error);
      if (error.name === 'NotAllowedError') {
        this.ns.show('OPERACIÓN CANCELADA POR EL USUARIO', 'warn');
      } else {
        this.ns.show('ERROR AL CONFIGURAR HUELLA', 'error');
      }
    } finally {
      this.isLoading = false;
    }
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editUser = { ...this.user };
      this.ns.show('MODO EDICIÓN ACTIVADO', 'info');
    }
  }

  saveChanges() {
    // Aquí podrías llamar a un servicio para guardar en la BD
    this.user = { ...this.editUser };
    this.isEditing = false;
    this.ns.show('DATOS ACTUALIZADOS LOCALMENTE (FALTA ENDPOINT SAVE)', 'success');
  }

  deleteAccount() {
    this.ns.show('ALERTA: ACCESO DENEGADO PARA ELIMINACIÓN DE CUENTA', 'error');
  }
}
