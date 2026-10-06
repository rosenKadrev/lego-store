import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-quantity-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="inline-flex items-center rounded-full border border-line-strong" [class.h-11]="large()" [class.h-9]="!large()">
      <button
        type="button"
        class="grid h-full w-9 place-items-center rounded-l-full hover:bg-surface-3 disabled:opacity-30"
        aria-label="Намали"
        [disabled]="value() <= min()"
        (click)="valueChange.emit(value() - 1)"
      >
        <app-icon name="minus" [size]="16" />
      </button>
      <span class="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{{ value() }}</span>
      <button
        type="button"
        class="grid h-full w-9 place-items-center rounded-r-full hover:bg-surface-3 disabled:opacity-30"
        aria-label="Увеличи"
        [disabled]="value() >= max()"
        (click)="valueChange.emit(value() + 1)"
      >
        <app-icon name="plus" [size]="16" />
      </button>
    </div>
  `,
})
export class QuantityStepper {
  readonly value = input.required<number>();
  readonly min = input(0);
  readonly max = input(99);
  readonly large = input(false);
  readonly valueChange = output<number>();
}
