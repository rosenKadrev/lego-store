import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Round LEGO colour dot; transparent colours get a checkerboard behind them. */
@Component({
  selector: 'app-color-swatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <span
      class="relative inline-block overflow-hidden rounded-full ring-1 ring-black/15"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [class]="trans() ? '[background:repeating-conic-gradient(#e4e4e7_0_25%,#fff_0_50%)_0_0/8px_8px]' : ''"
    >
      <span class="absolute inset-0" [style.background]="'#' + (rgb() ?? 'ccc')" [style.opacity]="trans() ? 0.7 : 1"></span>
    </span>
  `,
})
export class ColorSwatch {
  readonly rgb = input<string | null | undefined>();
  readonly trans = input(false);
  readonly size = input(14);
}
