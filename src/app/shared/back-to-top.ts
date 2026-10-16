import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Icon } from './icon';

/** Floating "back to top" button, shown once the page is scrolled past 1.5 screens (same as the catalog's). */
@Component({
  selector: 'app-back-to-top',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(window:scroll)': 'onScroll()', '(window:resize)': 'onScroll()' },
  template: `
    @if (visible()) {
      <button
        type="button"
        class="toast-in fixed right-4 bottom-4 z-30 grid size-12 place-items-center rounded-full bg-inverse text-on-inverse shadow-xl shadow-ink-900/30 ring-1 ring-white/15 transition hover:bg-inverse-hover sm:right-6 sm:bottom-6"
        aria-label="Към началото"
        title="Към началото"
        (click)="toTop()"
      >
        <app-icon name="arrowUp" [size]="20" [stroke]="2.5" />
      </button>
    }
  `,
})
export class BackToTop {
  protected readonly visible = signal(false);
  private frame = 0;

  protected onScroll(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.visible.set(window.scrollY > window.innerHeight * 1.5);
    });
  }

  protected toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
