import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Order, OrderItem, OrderStatus } from '../core/models';
import { Supabase } from '../core/supabase';

export type AdminOrder = Order & { order_items: OrderItem[] };

/** Statuses an order can move to from its current one (COD lifecycle). */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'refused'],
  delivered: ['paid', 'returned'],
  paid: ['returned'],
  cancelled: [],
  refused: [],
  returned: [],
};

export type StatusFilter = 'active' | OrderStatus | 'all';

type State = {
  orders: AdminOrder[];
  filter: StatusFilter;
  loading: boolean;
  expandedId: number | null;
  /** phone → number of past refused/returned orders, to flag risky COD customers */
  riskByPhone: Record<string, number>;
  error: string | null;
};

const ACTIVE: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered'];

export const AdminOrdersStore = signalStore(
  withState<State>({ orders: [], filter: 'active', loading: true, expandedId: null, riskByPhone: {}, error: null }),
  withComputed(({ orders }) => ({
    newCount: computed(() => orders().filter((o) => o.status === 'new').length),
  })),
  withMethods((store, supabase = inject(Supabase)) => {
    const db = supabase.client;

    async function load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      const f = store.filter();
      let query = db.from('orders').select('*, order_items(*)');
      if (f === 'active') query = query.in('status', ACTIVE);
      else if (f !== 'all') query = query.eq('status', f);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
      const orders = data ?? [];

      const phones = [...new Set(orders.map((o) => o.phone))];
      const riskByPhone: Record<string, number> = {};
      if (phones.length) {
        const { data: risky } = await db.from('orders').select('phone').in('phone', phones).in('status', ['refused', 'returned']);
        for (const r of risky ?? []) riskByPhone[r.phone] = (riskByPhone[r.phone] ?? 0) + 1;
      }
      patchState(store, { orders, riskByPhone, loading: false, error: error?.message ?? null });
    }

    return {
      load,

      setFilter(filter: StatusFilter): void {
        patchState(store, { filter, expandedId: null });
        void load();
      },

      toggle(id: number): void {
        patchState(store, { expandedId: store.expandedId() === id ? null : id });
      },

      async setStatus(order: AdminOrder, status: OrderStatus, trackingNumber?: string): Promise<void> {
        const { error } = await db.rpc('set_order_status', {
          p_order_id: order.id,
          p_status: status,
          p_tracking_number: trackingNumber?.trim() || undefined,
        });
        if (error) {
          patchState(store, { error: error.message });
          return;
        }
        patchState(store, {
          orders: store.orders().map((o) =>
            o.id === order.id ? { ...o, status, tracking_number: trackingNumber?.trim() || o.tracking_number } : o,
          ),
        });
      },
    };
  }),
);
