import { ChangeDetectionStrategy, Component, computed, inject, input, output, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Icon } from './icon';

/** Six full rows of 4, four of 6 etc. — every card grid width ends on a full row */
export const CARD_PAGE_SIZE = 24;

/** Pages of a list kept in the browser, with the page number in the URL (?page=2) so Back keeps the place.
 *  Call from a field initializer (needs the injection context). */
export function pagedList<T>(items: Signal<T[]>, pageSize = CARD_PAGE_SIZE) {
  const router = inject(Router);
  const requested = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => Math.max(1, Number(params.get('page')) || 1))),
    { initialValue: 1 },
  );
  const pageCount = computed(() => Math.max(1, Math.ceil(items().length / pageSize)));
  // A page past the end (fewer items than when the link was made) shows the last one
  const page = computed(() => Math.min(requested(), pageCount()));
  const navigate = (to: number, replaceUrl = false) =>
    void router.navigate([], { queryParams: { page: to > 1 ? to : null }, queryParamsHandling: 'merge', replaceUrl });
  return {
    page,
    pageCount,
    items: computed(() => items().slice((page() - 1) * pageSize, page() * pageSize)),
    goTo: (to: number) => navigate(to),
    /** Back to page 1 when the list changes (e.g. a search), without a new history entry */
    reset: () => requested() > 1 && navigate(1, true),
  };
}

/** Page buttons for short lists (every page number shown): ‹ 1 2 3 › */
@Component({
  selector: 'app-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (pageCount() > 1) {
      <nav class="mt-10 flex items-center justify-center gap-2" aria-label="Страници">
        <button type="button" class="btn-outline size-10 p-0" [disabled]="page() <= 1" aria-label="Предишна" (click)="go(page() - 1)">
          <app-icon name="chevronLeft" />
        </button>
        @for (p of pages(); track p) {
          <button
            type="button"
            class="btn size-10 p-0"
            [class]="p === page() ? 'bg-inverse text-on-inverse' : 'hover:bg-surface-3'"
            [attr.aria-current]="p === page() ? 'page' : null"
            (click)="go(p)"
          >
            {{ p }}
          </button>
        }
        <button type="button" class="btn-outline size-10 p-0" [disabled]="page() >= pageCount()" aria-label="Следваща" (click)="go(page() + 1)">
          <app-icon name="chevronRight" />
        </button>
      </nav>
    }
  `,
})
export class Pager {
  readonly page = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly pageChange = output<number>();
  protected readonly pages = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i + 1));

  protected go(page: number): void {
    this.pageChange.emit(page);
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  }
}
