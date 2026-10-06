import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ORDER_STATUS_LABEL, OrderStatus } from '../core/models';

const STATUS_CLASS: Record<OrderStatus, string> = {
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  confirmed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-300',
  shipped: 'bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-200',
  delivered: 'bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300',
  paid: 'bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300',
  cancelled: 'bg-surface-4 text-fg-2',
  refused: 'bg-brick-100 text-accent-ink',
  returned: 'bg-surface-4 text-fg-2',
};

@Component({
  selector: 'app-order-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="cssClass()">{{ label() }}</span>`,
})
export class OrderStatusBadge {
  readonly status = input.required<OrderStatus>();
  protected readonly label = computed(() => ORDER_STATUS_LABEL[this.status()]);
  protected readonly cssClass = computed(() => STATUS_CLASS[this.status()]);
}
