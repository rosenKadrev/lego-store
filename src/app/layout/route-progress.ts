import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { PageLoading } from '../core/page-loading';

/** Loads shorter than this show no bar at all */
const SHOW_AFTER_MS = 150;

/**
 * Thin bar at the top of the page while a route loads (e.g. the first visit to a lazy page)
 * or while its products load (PageLoading). It creeps towards 85% and jumps to 100% when done.
 */
@Component({
  selector: 'app-route-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]" role="progressbar" aria-label="Зареждане на страницата">
        <div
          class="h-full bg-brick-600 shadow-[0_0_8px_var(--color-brick-600)]"
          [style.width.%]="width()"
          [style.opacity]="finishing() ? 0 : 1"
          [style.transition]="finishing() ? 'width 200ms ease-out, opacity 250ms ease 150ms' : 'width 8s cubic-bezier(0.1, 0.7, 0.2, 1)'"
        ></div>
      </div>
    }
  `,
})
export class RouteProgress {
  protected readonly visible = signal(false);
  protected readonly width = signal(0);
  protected readonly finishing = signal(false);

  private readonly pageLoading = inject(PageLoading);
  private readonly navigating = signal(false);
  private readonly busy = computed(() => this.navigating() || this.pageLoading.active());

  constructor() {
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e instanceof NavigationStart) this.navigating.set(true);
        else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.navigating.set(false);
      });

    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const busy = this.busy();
      untracked(() => {
        if (busy) {
          // The page's products start loading right after the navigation ends: keep the same bar going
          clearTimeout(finishTimer);
          if (this.visible() && !this.finishing()) return;
          clearTimeout(hideTimer);
          clearTimeout(showTimer);
          showTimer = setTimeout(() => {
            this.finishing.set(false);
            this.width.set(0);
            this.visible.set(true);
            // Two frames so the bar is painted at 0% before it starts to grow
            requestAnimationFrame(() => requestAnimationFrame(() => this.width.set(85)));
          }, SHOW_AFTER_MS);
        } else {
          clearTimeout(showTimer);
          if (!this.visible()) return;
          finishTimer = setTimeout(() => {
            this.finishing.set(true);
            this.width.set(100);
            hideTimer = setTimeout(() => this.visible.set(false), 450);
          }, 80);
        }
      });
    });
  }
}
