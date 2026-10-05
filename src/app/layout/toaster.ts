import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Icon } from '../shared/icon';
import { ToastStore } from '../stores/toast.store';

@Component({
  selector: 'app-toaster',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
      aria-live="polite"
      role="status"
    >
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink-900 py-3 pr-2 pl-4 text-sm text-white shadow-2xl ring-1 shadow-ink-900/30 ring-white/15"
        >
          <span
            class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
            [class]="toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-brick-600' : 'bg-zinc-500'"
          >
            <app-icon [name]="toast.type === 'error' ? 'x' : 'check'" [size]="13" [stroke]="3" />
          </span>
          <p class="flex-1 leading-snug">{{ toast.text }}</p>
          <button
            type="button"
            class="-my-1 grid size-7 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Затвори"
            (click)="toasts.dismiss(toast.id)"
          >
            <app-icon name="close" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class Toaster {
  protected readonly toasts = inject(ToastStore);
}
