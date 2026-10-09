import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Notification {
  message: string;
  type: 'info' | 'success' | 'error' | 'warn';
  id: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new Subject<Notification>();
  notifications$ = this.notificationSubject.asObservable();
  private count = 0;

  show(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
    this.notificationSubject.next({ message, type, id: this.count++ });
  }
}
