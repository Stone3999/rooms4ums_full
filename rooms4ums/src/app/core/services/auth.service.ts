import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, catchError, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = '';

  private _isLoggedIn = signal<boolean>(false);
  private _isAdmin = signal<boolean>(false);
  get isLoggedIn() { return this._isLoggedIn.asReadonly(); }
  get isAdmin() { return this._isAdmin.asReadonly(); }

  constructor() {
    // Forzamos el uso del backend en Render (ahora también para SSR)
    const baseUrl = 'https://rooms4ums.onrender.com';
    this.apiUrl = `${baseUrl}/api/auth`;

    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        this._isLoggedIn.set(true);
        this.checkAdminStatus();
      }
    }
  }

  private async checkAdminStatus() {
    try {
      const profile = await this.getProfile();
      this._isAdmin.set(profile.role === 'ADMIN' || profile.role_name === 'ADMIN');
    } catch {
      this._isAdmin.set(false);
    }
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return headers;
  }

  async getProfile() {
    return firstValueFrom(
      this.http.get<any>(`${this.apiUrl}/profile`, { headers: this.getHeaders() })
    );
  }

  async generateRegistrationOptions() {
    return firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/generate-registration-options`, {}, { headers: this.getHeaders() })
    );
  }

  async verifyRegistration(registrationResponse: any, expectedChallenge: string) {
    return firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/verify-registration`, {
        registrationResponse,
        expectedChallenge
      }, { headers: this.getHeaders() })
    );
  }

  async generateAuthenticationOptions(identifier: string) {
    return firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/generate-authentication-options`, { identifier })
    );
  }

  async verifyAuthentication(identifier: string, authenticationResponse: any, expectedChallenge: string) {
    const response: any = await firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/verify-authentication`, {
        identifier,
        authenticationResponse,
        expectedChallenge
      })
    );
    if (response.token && isPlatformBrowser(this.platformId)) {
      this._isLoggedIn.set(true);
      localStorage.setItem('token', response.token);
      this.checkAdminStatus();
    }
    return response;
  }

  async register(userData: any) {
    // ... (rest of the code)
    console.log('[AUTH_SERVICE] Intentando registro:', userData);
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/register`, userData).pipe(
          tap(res => console.log('[AUTH_SERVICE] Respuesta exitosa:', res)),
          catchError(err => {
            console.error('[AUTH_SERVICE] Error en la petición HTTP:', err);
            throw err;
          })
        )
      );
      return response;
    } catch (error) {
      console.error('[AUTH_SERVICE] Error capturado en register():', error);
      throw error;
    }
  }

  async checkUser(identifier: string) {
    console.log('[AUTH_SERVICE] Verificando usuario:', identifier);
    return firstValueFrom(
      this.http.post<any>(`${this.apiUrl}/check-user`, { identifier })
    );
  }

  async login(credentials: any) {
    console.log('[AUTH_SERVICE] Intentando login...');
    const response: any = await firstValueFrom(
      this.http.post(`${this.apiUrl}/login-password`, credentials)
    );
    if (response.token && isPlatformBrowser(this.platformId)) {
      this._isLoggedIn.set(true);
      localStorage.setItem('token', response.token);
      this.checkAdminStatus();
    }
    return response;
  }

  async logout() {
    try {
      // Avisamos al backend para que borre de Redis
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/logout`, {}, { headers: this.getHeaders() })
      );
    } catch (error) {
      console.error('[AUTH_SERVICE] Error al cerrar sesión en el servidor:', error);
    } finally {
      // Pase lo que pase, limpiamos el cliente
      this._isLoggedIn.set(false);
      this._isAdmin.set(false);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.removeItem('token');
      }
    }
  }

  // --- ADMIN FUNCTIONS ---
  private adminUrl = 'https://rooms4ums.onrender.com/api/admin';

  async getAllUsers() {
    return firstValueFrom(
      this.http.get<any[]>(`${this.adminUrl}/users`, { headers: this.getHeaders() })
    );
  }

  async getAllRoles() {
    return firstValueFrom(
      this.http.get<any[]>(`${this.adminUrl}/roles`, { headers: this.getHeaders() })
    );
  }

  async createUser(data: any) {
    return firstValueFrom(
      this.http.post<any>(`${this.adminUrl}/users`, data, { headers: this.getHeaders() })
    );
  }

  async updateUser(userId: string, data: any) {
    return firstValueFrom(
      this.http.put<any>(`${this.adminUrl}/users/${userId}`, data, { headers: this.getHeaders() })
    );
  }

  async updateUserStatus(userId: string, status: string) {
    // El backend espera isActive, status es 'ACTIVE' | 'BANNED' etc, adaptarlo
    const isActive = status === 'ACTIVE';
    return firstValueFrom(
      this.http.put<any>(`${this.adminUrl}/users/${userId}/status`, { is_active: isActive }, { headers: this.getHeaders() })
    );
  }

  async deleteUser(userId: string) {
    return firstValueFrom(
      this.http.delete<any>(`${this.adminUrl}/users/${userId}`, { headers: this.getHeaders() })
    );
  }
}
