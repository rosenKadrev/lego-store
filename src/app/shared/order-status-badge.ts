import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ORDER_STATUS_LABEL, OrderStatus } from '../core/models';

const STATUS_CLASS: Record<OrderStatus, string> = {
  new: 'bg-sky-100 text-sky-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-amber-100 text-amber-800',
  delivered: 'bg-teal-100 text-teal-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-zinc-200 text-zinc-700',
  refused: 'bg-brick-100 text-brick-800',
  returned: 'bg-zinc-200 text-zinc-700',
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
