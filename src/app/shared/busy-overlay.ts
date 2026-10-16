import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Busy } from '../core/busy';
import { Icon } from './icon';

/**
 * Blocks clicks on the whole page while Busy has work. The dim backdrop and spinner only appear
 * after a moment, so quick saves don't flash.
 */
@Component({
  selector: 'app-busy-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (busy.active()) {
      <div
        class="fixed inset-0 z-[100] grid cursor-wait place-items-center transition-colors duration-200"
        [class.bg-ink-900/40]="shown()"
        role="alert"
        aria-busy="true"
        [attr.aria-label]="busy.label()"
      >
        @if (shown()) {
          <div class="toast-in flex items-center gap-3 rounded-2xl bg-surface px-5 py-4 font-semibold shadow-2xl ring-1 ring-line">
            <app-icon name="refresh" [size]="20" class="animate-spin text-accent" />
            {{ busy.label() }}
          </div>
        }
      </div>
    }
  `,
})
export class BusyOverlay {
  protected readonly busy = inject(Busy);
  protected readonly shown = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (!this.busy.active()) {
        this.shown.set(false);
        return;
      }
      // So Enter in a focused field can't fire the same action again
      (document.activeElement as HTMLElement | null)?.blur();
      const timer = setTimeout(() => this.shown.set(true), 300);
      onCleanup(() => clearTimeout(timer));
    });
  }
}
