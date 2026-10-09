import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Room {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'CONSTRUCTION' | 'ARCHIVED';
  is_interactive: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = '';

  constructor() {
    // Forzamos el uso del backend en Render
    const baseUrl = 'https://rooms4ums.onrender.com';
    this.apiUrl = `${baseUrl}/api/rooms`;
  }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  // PÚBLICO
  async getActiveRooms(): Promise<Room[]> {
    return firstValueFrom(this.http.get<Room[]>(this.apiUrl));
  }

  async getRoomBySlug(slug: string): Promise<Room> {
    return firstValueFrom(this.http.get<Room>(`${this.apiUrl}/slug/${slug}`));
  }

  // ADMIN
  async getAllRooms(): Promise<Room[]> {
    return firstValueFrom(this.http.get<Room[]>(`${this.apiUrl}/admin/all`, { headers: this.getHeaders() }));
  }

  async createRoom(room: Partial<Room>): Promise<Room> {
    return firstValueFrom(this.http.post<Room>(this.apiUrl, room, { headers: this.getHeaders() }));
  }

  async updateRoom(id: string, room: Partial<Room>): Promise<Room> {
    return firstValueFrom(this.http.put<Room>(`${this.apiUrl}/${id}`, room, { headers: this.getHeaders() }));
  }

  async deleteRoom(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }));
  }
}
