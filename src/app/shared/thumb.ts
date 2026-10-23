import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';
import { Icon } from './icon';

/** A product thumbnail that shows the "no photo" icon when there is no image or it doesn't load (Rebrickable removes some). */
@Component({
  selector: 'app-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'contents' },
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" [alt]="alt()" [attr.loading]="lazy() ? 'lazy' : null" [class]="imgClass()" (error)="failed.set(true)" />
    } @else {
      <span class="grid size-full place-items-center text-fg-ghost" title="Няма снимка"><app-icon name="image" [size]="iconSize()" /></span>
    }
  `,
})
export class Thumb {
  readonly src = input<string | null | undefined>();
  readonly alt = input('');
  readonly imgClass = input('size-full object-contain p-1 mix-blend-multiply');
  readonly iconSize = input(20);
  readonly lazy = input(true);
  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
}
