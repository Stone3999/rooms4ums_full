import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { LanguageService } from '../../core/services/language.service';
import { ForumService, Post } from '../../core/services/forum.service';

@Component({
  selector: 'app-popular',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './popular.component.html',
  styleUrl: './popular.component.css'
})
export class PopularComponent implements OnInit {
  private router = inject(Router);
  public langService = inject(LanguageService);
  private forumService = inject(ForumService);

  public popularRooms: any[] = [];
  public isLoading = true;

  async ngOnInit() {
    try {
      const posts = await this.forumService.getPopular(20);
      this.groupPostsByRoom(posts);
    } catch (error) {
      console.error('Error fetching popular posts:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private groupPostsByRoom(posts: Post[]) {
    const grouped = new Map<string, any>();
    
    for (const post of posts) {
      if (!grouped.has(post.roomId)) {
        grouped.set(post.roomId, {
          id: post.roomId,
          name: post.roomId.toUpperCase(),
          posts: []
        });
      }
      
      const room = grouped.get(post.roomId);
      room.posts.push({
        id: post._id,
        title: post.title,
        author: post.authorName,
        likes: post.viewCount, // Using viewCount as a proxy for popularity for now
        dislikes: 0
      });
    }

    this.popularRooms = Array.from(grouped.values());
  }

  goToPost(roomId: string, postId: string) {
    this.router.navigate(['/foro', roomId, 'post', postId]);
  }
}
