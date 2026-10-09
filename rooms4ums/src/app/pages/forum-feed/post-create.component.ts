import { Component, inject, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ForumService } from '../../core/services/forum.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-post-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="post-create-container win-panel">
      <div class="win-title-bar">
        <div class="win-title">{{ langService.translate('NEW_POST') }}</div>
        <button class="win-button close" (click)="onCancel.emit()">X</button>
      </div>

      <div class="form-content">
        <div class="field">
          <label>{{ langService.translate('TITLE') }}</label>
          <input type="text" [(ngModel)]="postData.title" class="win-input" placeholder="Título del post...">
        </div>

        <div class="field">
          <label>{{ langService.translate('CONTENT') }}</label>
          <textarea [(ngModel)]="postData.content" class="win-input" rows="6" placeholder="¿Qué estás pensando?"></textarea>
        </div>

        <div class="field">
          <label>{{ langService.translate('ATTACHMENTS') }} (Max 5)</label>
          <div class="file-upload-zone" (click)="fileInput.click()">
            <i class="pixelart-icons-font-cloud-upload"></i>
            <span>{{ selectedFiles.length > 0 ? selectedFiles.length + ' archivos seleccionados' : 'Click para subir archivos (PNG, JPG, PDF, ZIP)' }}</span>
            <input #fileInput type="file" multiple (change)="onFileSelected($event)" style="display: none" accept="image/*,.pdf,.zip">
          </div>
          
          <div class="files-preview" *ngIf="selectedFiles.length > 0">
            <div *ngFor="let file of selectedFiles; let i = index" class="file-item win-panel">
              <span class="file-name">{{ file.name }}</span>
              <button class="win-button mini" (click)="removeFile(i)">X</button>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="win-button" (click)="onCancel.emit()">{{ langService.translate('CANCEL') }}</button>
          <button class="win-button accent" [disabled]="isSubmitting() || !postData.title || !postData.content" (click)="submit()">
            {{ isSubmitting() ? 'PUBLICANDO...' : langService.translate('PUBLISH') }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; max-width: 600px; }
    .post-create-container { width: 100%; margin: 0 auto; flex-shrink: 0; }
    .form-content { padding: 15px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; max-height: 80vh; }
    .field { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
    .field label { font-size: 0.7rem; font-weight: bold; color: var(--accent-color); }
    
    .file-upload-zone {
      border: 2px dashed #444; padding: 20px; text-align: center; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 10px; transition: 0.2s;
    }
    .file-upload-zone:hover { border-color: var(--accent-color); background: #111; }
    .file-upload-zone i { font-size: 2rem; color: var(--accent-color); }
    .file-upload-zone span { font-size: 0.75rem; }

    .files-preview { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
    .file-item { padding: 5px 10px; display: flex; align-items: center; gap: 10px; background: #111; font-size: 0.7rem; }
    .file-name { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
    textarea { resize: vertical; }
  `]
})
export class PostCreateComponent {
  @Input() roomId: string = '';
  @Output() onCreated = new EventEmitter<any>();
  @Output() onCancel = new EventEmitter<void>();

  forumService = inject(ForumService);
  langService = inject(LanguageService);

  postData = { title: '', content: '' };
  selectedFiles: File[] = [];
  isSubmitting = signal(false);

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        if (this.selectedFiles.length < 5) {
          this.selectedFiles.push(files[i]);
        }
      }
    }
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  async submit() {
    if (!this.postData.title || !this.postData.content) return;

    this.isSubmitting.set(true);
    const formData = new FormData();
    formData.append('title', this.postData.title);
    formData.append('content', this.postData.content);
    formData.append('roomId', this.roomId);
    
    this.selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const result = await this.forumService.createPost(formData);
      this.onCreated.emit(result);
      this.isSubmitting.set(false);
    } catch (error) {
      console.error('Error creating post:', error);
      this.isSubmitting.set(false);
    }
  }
}
