import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
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
        (error)="index.set(index() + 1)"
      />
    }
  `,
})
export class ThemeThumb {
  readonly images = input.required<ThemeImage[]>();
  readonly imgClass = input('size-full');
  readonly lazy = input(true);
  protected readonly index = linkedSignal({ source: this.images, computation: () => 0 });
  protected readonly image = computed(() => this.images()[this.index()] ?? null);
}
