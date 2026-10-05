import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COURIER_LABEL, DELIVERY_LABEL, displayItemNum, ORDER_STATUS_LABEL, OrderStatus } from '../core/models';
import { Icon } from '../shared/icon';
import { OrderStatusBadge } from '../shared/order-status-badge';
import { AdminOrder, AdminOrdersStore, NEXT_STATUSES, StatusFilter } from './admin-orders.store';

@Component({
  selector: 'app-admin-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CurrencyPipe, DatePipe, Icon, OrderStatusBadge],
  providers: [AdminOrdersStore],
  template: `
    <div class="flex gap-2 overflow-x-auto pb-1">
      @for (f of filters; track f.value) {
        <button
          type="button"
          class="chip shrink-0 px-4 py-2 text-sm"
          [class]="store.filter() === f.value ? 'bg-ink-900 text-white' : 'bg-zinc-100 text-ink-900 hover:bg-zinc-200'"
          (click)="store.setFilter(f.value)"
        >
          {{ f.label }}
        </button>
      }
    </div>

    @if (store.error()) {
      <p class="mt-4 rounded-xl bg-brick-50 p-3 text-sm text-brick-800">{{ store.error() }}</p>
    }

    <ul class="mt-5 space-y-3" [class.opacity-60]="store.loading()">
      @for (order of store.orders(); track order.id) {
        @let open = store.expandedId() === order.id;
        @let risk = store.riskByPhone()[order.phone] ?? 0;
        <li class="card overflow-hidden">
          <button type="button" class="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left hover:bg-zinc-50" (click)="store.toggle(order.id)">
            <span class="min-w-28">
              <b class="block">{{ order.number }}</b>
              <span class="text-xs text-zinc-500">{{ order.created_at | date: 'd.MM.y HH:mm' }}</span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium">{{ order.customer_name }}</span>
              <span class="text-xs text-zinc-500">{{ order.phone }} · {{ order.delivery_type === 'pickup' ? 'Лично взимане' : order.city }}</span>
            </span>
            @if (risk) {
              <span class="chip bg-brick-600 text-white" title="Предишни неприети или върнати пратки">⚠ {{ risk }} отказ{{ risk > 1 ? 'а' : '' }}</span>
            }
            <app-order-status-badge [status]="order.status" />
            <b class="w-24 text-right">{{ order.total | currency }}</b>
            <app-icon name="chevronDown" [size]="18" class="transition" [class.rotate-180]="open" />
          </button>

          @if (open) {
            <div class="grid gap-6 border-t border-zinc-100 bg-zinc-50/60 p-4 md:grid-cols-2">
              <div class="space-y-3 text-sm">
                <h3 class="font-bold">Доставка</h3>
                @if (order.delivery_type === 'pickup') {
                  <p class="font-semibold">Лично взимане</p>
                } @else {
                  <p>
                    {{ order.courier ? courierLabel[order.courier] : '' }} · {{ deliveryLabel[order.delivery_type] }}<br />
                    {{ order.city }}, {{ order.delivery_type === 'office' ? order.office_code : order.address }}
                  </p>
                }
                <p>
                  <a [href]="'tel:' + order.phone" class="font-semibold text-brick-600">{{ order.phone }}</a><br />
                  <a [href]="'mailto:' + order.email" class="text-zinc-600">{{ order.email }}</a>
                </p>
                @if (order.note) {
                  <p class="rounded-xl bg-stud-300/40 p-3">{{ order.note }}</p>
                }
                @if (order.tracking_number) {
                  <p>Товарителница: <b>{{ order.tracking_number }}</b></p>
                }
              </div>

              <div class="space-y-3 text-sm">
                <h3 class="font-bold">Продукти</h3>
                <ul class="space-y-1">
                  @for (item of order.order_items; track item.id) {
                    <li class="flex justify-between gap-3">
                      <span>{{ item.quantity }} × {{ item.name }} <span class="text-zinc-500">({{ itemNum(item.item_num) }}, {{ item.condition === 'new' ? 'ново' : 'употр.' }})</span></span>
                      <span class="whitespace-nowrap">{{ item.unit_price * item.quantity | currency }}</span>
                    </li>
                  }
                  @if (order.delivery_type === 'pickup') {
                    <li class="flex justify-between text-zinc-500"><span>Лично взимане</span><span>{{ 0 | currency }}</span></li>
                  } @else {
                    <li class="flex items-center justify-between gap-3 text-zinc-500">
                      <span>Доставка</span>
                      @if (order.shipping_price != null && editingShipping() !== order.id) {
                        <button type="button" class="hover:text-ink-900 hover:underline" title="Промени" (click)="startShippingEdit(order)">
                          {{ order.shipping_price | currency }}
                        </button>
                      } @else {
                        <form class="flex items-center gap-1" (submit)="$event.preventDefault(); saveShipping(order)">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            class="input w-24 py-1.5 text-right"
                            placeholder="€"
                            [attr.aria-label]="'Цена на доставката за ' + order.number"
                            [(ngModel)]="shippingDraft[order.id]"
                            [name]="'shipping-' + order.id"
                          />
                          <button type="submit" class="btn-dark px-3 py-1.5 text-xs">Запази</button>
                        </form>
                      }
                    </li>
                    @if (order.shipping_price == null) {
                      <li class="text-xs text-amber-700">Цената на доставката още не е уточнена с клиента.</li>
                    }
                  }
                  <li class="flex justify-between border-t border-zinc-200 pt-1 font-bold">
                    <span>{{ order.delivery_type === 'pickup' ? 'Общо (в брой при взимане)' : 'Общо (наложен платеж)' }}</span>
                    <span>{{ order.total | currency }}{{ order.shipping_price == null && order.delivery_type !== 'pickup' ? ' + доставка' : '' }}</span>
                  </li>
                </ul>
              </div>

              @if (next(order.status).length) {
                <div class="flex flex-wrap items-end gap-2 md:col-span-2">
                  @if (order.status === 'confirmed' && order.delivery_type !== 'pickup') {
                    <div class="w-full sm:w-56">
                      <label class="label" [for]="'tracking-' + order.id">Товарителница</label>
                      <input [id]="'tracking-' + order.id" class="input" [(ngModel)]="tracking[order.id]" placeholder="Номер на пратката" />
                    </div>
                  }
                  @for (status of next(order.status); track status) {
                    <button
                      type="button"
                      [class]="isNegative(status) ? 'btn-outline text-brick-700' : 'btn-dark'"
                      (click)="changeStatus(order, status)"
                    >
                      {{ actionLabel(status, order) }}
                    </button>
                  }
                </div>
              }
            </div>
          }
        </li>
      } @empty {
        <li class="rounded-2xl bg-zinc-50 p-10 text-center text-sm text-zinc-500">
          {{ store.loading() ? 'Зареждане…' : 'Няма поръчки.' }}
        </li>
      }
    </ul>
  `,
})
export class AdminOrders implements OnInit {
  protected readonly store = inject(AdminOrdersStore);
  protected readonly courierLabel = COURIER_LABEL;
  protected readonly deliveryLabel = DELIVERY_LABEL;
  protected readonly itemNum = displayItemNum;
  protected readonly tracking: Record<number, string> = {};

  protected readonly filters: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Активни' },
    { value: 'new', label: ORDER_STATUS_LABEL.new },
    { value: 'confirmed', label: ORDER_STATUS_LABEL.confirmed },
    { value: 'shipped', label: ORDER_STATUS_LABEL.shipped },
    { value: 'delivered', label: ORDER_STATUS_LABEL.delivered },
    { value: 'paid', label: ORDER_STATUS_LABEL.paid },
    { value: 'refused', label: ORDER_STATUS_LABEL.refused },
    { value: 'cancelled', label: ORDER_STATUS_LABEL.cancelled },
    { value: 'all', label: 'Всички' },
  ];

  ngOnInit(): void {
    void this.store.load();
  }

  protected next(status: OrderStatus): OrderStatus[] {
    return NEXT_STATUSES[status];
  }

  protected isNegative(status: OrderStatus): boolean {
    return status === 'cancelled' || status === 'refused' || status === 'returned';
  }

  protected actionLabel(status: OrderStatus, order?: AdminOrder): string {
    if (order?.delivery_type === 'pickup') {
      if (status === 'shipped') return 'Готова за взимане';
      if (status === 'delivered') return 'Взета';
      if (status === 'refused') return 'Не дойде';
    }
    const labels: Record<OrderStatus, string> = {
      new: 'Нова',
      confirmed: 'Потвърди',
      shipped: 'Маркирай като изпратена',
      delivered: 'Доставена',
      paid: 'Получено плащане',
      cancelled: 'Откажи',
      refused: 'Неприета пратка',
      returned: 'Върната',
    };
    return labels[status];
  }

  protected readonly editingShipping = signal<number | null>(null);
  protected readonly shippingDraft: Record<number, number | null> = {};

  protected startShippingEdit(order: AdminOrder): void {
    this.shippingDraft[order.id] = order.shipping_price;
    this.editingShipping.set(order.id);
  }

  protected async saveShipping(order: AdminOrder): Promise<void> {
    const price = this.shippingDraft[order.id];
    if (price == null || price < 0) return;
    if (await this.store.setShipping(order, price)) this.editingShipping.set(null);
  }

  protected changeStatus(order: AdminOrder, status: OrderStatus): void {
    if (status === 'shipped' && order.delivery_type !== 'pickup' && order.shipping_price == null) {
      if (!confirm('Цената на доставката още не е въведена. Да маркирам ли поръчката като изпратена въпреки това?')) return;
    }
    if (this.isNegative(status) && !confirm(`${this.actionLabel(status, order)}? Наличността ще бъде върната.`)) return;
    const tracking = status === 'shipped' && order.delivery_type !== 'pickup' ? this.tracking[order.id] : undefined;
    void this.store.setStatus(order, status, tracking);
  }
}
