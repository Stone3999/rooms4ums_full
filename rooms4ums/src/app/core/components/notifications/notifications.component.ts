import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-wrapper">
      <div *ngFor="let n of notifications" 
           class="toast win-panel" 
           [ngClass]="n.type"
           (click)="remove(n.id)">
        <div class="toast-header">
          <i class="pixelart-icons-font-alert"></i>
          <span>SYS_MESSAGE [{{n.type | uppercase}}]</span>
        </div>
        <div class="toast-body">{{n.message}}</div>
        <div class="toast-footer">CLICK PARA CERRAR</div>
      </div>
    </div>
  `,
  styles: [`
    .notifications-wrapper {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 15px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      width: 320px;
      background-color: var(--bg-color);
      border: 3px solid;
      padding: 0;
      animation: slideIn 0.3s ease-out forwards;
      cursor: pointer;
    }
    .toast.info { border-color: var(--accent-color); color: var(--accent-color); }
    .toast.success { border-color: #00ff00; color: #00ff00; }
    .toast.error { border-color: #ff0000; color: #ff0000; }

    .toast-header {
      background-color: currentColor;
      color: black;
      padding: 4px 10px;
      font-size: 0.65rem;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .toast-body {
      padding: 15px;
      font-size: 0.85rem;
      font-family: monospace;
      line-height: 1.4;
    }
    .toast-footer {
      font-size: 0.55rem;
      padding: 4px;
      text-align: center;
      border-top: 1px dashed;
      opacity: 0.7;
    }

    @keyframes slideIn {
      from { transform: translateX(110%); }
      to { transform: translateX(0); }
    }
  `]
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];

  constructor(private ns: NotificationService) {}

  ngOnInit() {
    this.ns.notifications$.subscribe(n => {
      this.notifications.push(n);
      setTimeout(() => this.remove(n.id), 5000); // Auto-cerrar en 5 segundos
    });
  }

  remove(id: number) {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }
}
