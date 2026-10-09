import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Post {
  _id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  roomId: string;
  attachments: { url: string; type: string; name: string }[];
  viewCount: number;
  commentCount: number;
  tags: string[];
  createdAt: string;
}

export interface Comment {
  _id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  attachments: { url: string; type: string; name: string }[];
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ForumService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = '';

  constructor() {
    // Forzamos el uso del backend en Render
    const baseUrl = 'https://rooms4ums.onrender.com';
    this.apiUrl = `${baseUrl}/api/forum`;
  }

  private getHeaders() {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }
    return headers;
  }

  async getPostsByRoom(roomId: string, page = 1, limit = 20) {
    return firstValueFrom(this.http.get<{ data: Post[], total: number }>(
      `${this.apiUrl}/rooms/${roomId}/posts?page=${page}&limit=${limit}`
    ));
  }

  async getPostById(id: string): Promise<Post> {
    return firstValueFrom(this.http.get<Post>(`${this.apiUrl}/posts/${id}`));
  }

  async createPost(formData: FormData): Promise<Post> {
    return firstValueFrom(this.http.post<Post>(`${this.apiUrl}/posts`, formData, { 
      headers: this.getHeaders() 
    }));
  }

  async getComments(postId: string, page = 1, limit = 50) {
    return firstValueFrom(this.http.get<{ data: Comment[], total: number }>(
      `${this.apiUrl}/posts/${postId}/comments?page=${page}&limit=${limit}`
    ));
  }

  async createComment(postId: string, content: string): Promise<Comment> {
    return firstValueFrom(this.http.post<Comment>(`${this.apiUrl}/posts/${postId}/comments`, { content }, { 
      headers: this.getHeaders() 
    }));
  }

  async getPopular(limit = 5): Promise<Post[]> {
    return firstValueFrom(this.http.get<Post[]>(`${this.apiUrl}/popular?limit=${limit}`));
  }

  async getRecent(limit = 10): Promise<Post[]> {
    return firstValueFrom(this.http.get<Post[]>(`${this.apiUrl}/recent?limit=${limit}`));
  }
}
