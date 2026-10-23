import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ThemeImage } from '../stores/themes.store';

/** A theme's picture: the first of `images` that loads (Rebrickable images can disappear), else nothing. */
@Component({
  selector: 'app-theme-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (image(); as img) {
      <img
        [src]="img.src"
        alt=""
        [attr.loading]="lazy() ? 'lazy' : null"
        [class]="imgClass() + (img.photo ? ' object-cover' : ' object-contain mix-blend-multiply')"
        (error)="imageFailed(img.src)"
      />
    }
  `,
})
export class ThemeThumb {
  readonly images = input.required<ThemeImage[]>();
  readonly imgClass = input('size-full');
  readonly lazy = input(true);
  /** By URL, not position: the parent passes a new (equal) array on every change detection */
  protected readonly failed = signal<string[]>([]);
  protected readonly image = computed(() => this.images().find((img) => !this.failed().includes(img.src)) ?? null);

  protected imageFailed(src: string): void {
    this.failed.update((srcs) => [...srcs, src]);
  }
}
