import { Directive, ElementRef, HostListener, Input, Renderer2, inject } from '@angular/core';

export type HighlightEffect = 'glow' | 'border' | 'spotlight' | 'lift';

@Directive({
  selector: '[appPointerHighlight]',
  standalone: true
})
export class PointerHighlightDirective {
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  @Input('appPointerHighlight') effect: HighlightEffect = 'glow';
  @Input() highlightColor: string = 'var(--accent-color)';
  @Input() highlightScale: number = 1.02;
  @Input() highlightDuration: string = '0.3s';

  private originalStyles: Record<string, string> = {};

  @HostListener('mouseenter', ['$event'])
  onPointerEnter(event: MouseEvent): void {
    const target = this.el.nativeElement;
    this.saveOriginalStyles(target);

    switch (this.effect) {
      case 'glow':
        this.applyGlowEffect(target);
        break;
      case 'border':
        this.applyBorderEffect(target);
        break;
      case 'spotlight':
        this.applySpotlightEffect(target);
        break;
      case 'lift':
        this.applyLiftEffect(target);
        break;
    }
  }

  @HostListener('mousemove', ['$event'])
  onPointerMove(event: MouseEvent): void {
    if (this.effect === 'spotlight') {
      const target = this.el.nativeElement;
      const rect = target.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      target.style.setProperty('--spotlight-x', `${x}%`);
      target.style.setProperty('--spotlight-y', `${y}%`);
    }
  }

  @HostListener('mouseleave')
  onPointerLeave(): void {
    this.restoreOriginalStyles();
  }

  private saveOriginalStyles(target: HTMLElement): void {
    const props = ['boxShadow', 'borderColor', 'transform', 'transition', 'background', 'outline'];
    for (const prop of props) {
      this.originalStyles[prop] = target.style.getPropertyValue(prop) || '';
    }
  }

  private restoreOriginalStyles(): void {
    const target = this.el.nativeElement;
    for (const [prop, value] of Object.entries(this.originalStyles)) {
      target.style.setProperty(this.camelToKebab(prop), value || '');
    }
  }

  private applyGlowEffect(target: HTMLElement): void {
    this.renderer.setStyle(target, 'boxShadow', `0 0 20px var(--season-glow, rgba(255,140,0,0.3))`);
    this.renderer.setStyle(target, 'borderColor', 'var(--accent-color)');
    this.renderer.setStyle(target, 'transition', `all ${this.highlightDuration} ease`);
  }

  private applyBorderEffect(target: HTMLElement): void {
    this.renderer.setStyle(target, 'outline', `2px solid var(--accent-color)`);
    this.renderer.setStyle(target, 'outlineOffset', '2px');
    this.renderer.setStyle(target, 'transition', `outline ${this.highlightDuration} ease, outline-offset ${this.highlightDuration} ease`);
  }

  private applySpotlightEffect(target: HTMLElement): void {
    this.renderer.setStyle(target, 'position', 'relative');
    this.renderer.setStyle(target, 'overflow', 'hidden');
    this.renderer.setStyle(target, 'transition', `all ${this.highlightDuration} ease`);
    const spotStyle = this.renderer.createElement('style');
    spotStyle.id = 'spotlight-style';
    this.renderer.appendChild(target, spotStyle);
  }

  private applyLiftEffect(target: HTMLElement): void {
    this.renderer.setStyle(target, 'transform', `translateY(-4px) scale(${this.highlightScale})`);
    this.renderer.setStyle(target, 'boxShadow', `0 8px 25px rgba(0,0,0,0.5), 0 0 15px var(--season-glow, rgba(255,140,0,0.2))`);
    this.renderer.setStyle(target, 'transition', `all ${this.highlightDuration} cubic-bezier(0.4, 0, 0.2, 1)`);
    this.renderer.setStyle(target, 'zIndex', '10');
  }

  private camelToKebab(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  }
}
