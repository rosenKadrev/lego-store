import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Busy } from '../core/busy';
import { Order, OrderItem, ORDER_STATUS_LABEL, OrderStatus } from '../core/models';
import { Supabase } from '../core/supabase';
import { ToastStore } from '../stores/toast.store';

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
  /** order number, customer name, phone or e-mail */
  q: string;
  page: number;
  /** orders matching the filter and search, on all pages */
  total: number;
  loading: boolean;
  expandedId: number | null;
  /** phone → number of past refused/returned orders, to flag risky COD customers */
  riskByPhone: Record<string, number>;
  /** listing id → picture (own photo, else catalog image) for the ordered items */
  imageByListing: Record<number, string | null>;
  error: string | null;
};

const ACTIVE: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered'];
export const ORDERS_PAGE_SIZE = 20;

/** PostgREST `or` filter for the search box; phones are stored as typed (0888…, +359888…), so match the digits after 0 / 359 */
function searchFilter(q: string): string | null {
  const term = q.replace(/[,()*%]/g, ' ').trim();
  if (!term) return null;
  const filters = [`number.ilike.*${term}*`, `customer_name.ilike.*${term}*`, `email.ilike.*${term}*`];
  const digits = term.replace(/\D/g, '').replace(/^(00359|359|0)/, '');
  if (digits.length >= 4) filters.push(`phone.ilike.*${digits}*`);
  return filters.join(',');
}

export const AdminOrdersStore = signalStore(
  withState<State>({ orders: [], filter: 'active', q: '', page: 1, total: 0, loading: true, expandedId: null, riskByPhone: {}, imageByListing: {}, error: null }),
  withComputed(({ orders }) => ({
    newCount: computed(() => orders().filter((o) => o.status === 'new').length),
  })),
  withMethods((store, supabase = inject(Supabase), toast = inject(ToastStore), busy = inject(Busy)) => {
    const db = supabase.client;
    let requestId = 0;

    async function load(): Promise<void> {
      const id = ++requestId;
      patchState(store, { loading: true, error: null });
      const f = store.filter();
      let query = db.from('orders').select('*, order_items(*)', { count: 'exact' });
      if (f === 'active') query = query.in('status', ACTIVE);
      else if (f !== 'all') query = query.eq('status', f);
      const search = searchFilter(store.q());
      if (search) query = query.or(search);
      const from = (store.page() - 1) * ORDERS_PAGE_SIZE;
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + ORDERS_PAGE_SIZE - 1);
      const orders = data ?? [];

      const phones = [...new Set(orders.map((o) => o.phone))];
      const riskByPhone: Record<string, number> = {};
      if (phones.length) {
        const { data: risky } = await db.from('orders').select('phone').in('phone', phones).in('status', ['refused', 'returned']);
        for (const r of risky ?? []) riskByPhone[r.phone] = (riskByPhone[r.phone] ?? 0) + 1;
      }
      const listingIds = [...new Set(orders.flatMap((o) => o.order_items.map((i) => i.listing_id)))];
      const imageByListing: Record<number, string | null> = {};
      if (listingIds.length) {
        const { data: listings } = await db.from('catalog_listings').select('id, cover_path, catalog_img_url').in('id', listingIds);
        for (const l of listings ?? []) imageByListing[l.id!] = supabase.coverUrl(l);
      }
      if (id !== requestId) return; // a newer filter was picked meanwhile
      patchState(store, { orders, total: count ?? 0, riskByPhone, imageByListing, loading: false, error: error?.message ?? null });
    }

    return {
      load,

      setFilter(filter: StatusFilter): void {
        patchState(store, { filter, page: 1, expandedId: null });
        void load();
      },

      setSearch(q: string): void {
        patchState(store, { q, page: 1, expandedId: null });
        void load();
      },

      setPage(page: number): void {
        patchState(store, { page, expandedId: null });
        void load();
      },

      /** Opened from the admin bell: reload (it may be brand new) and expand it; when the filter, search or
       *  page hides it, search for its number under "Всички" */
      async openOrder(id: number): Promise<void> {
        await load();
        if (!store.orders().some((o) => o.id === id)) {
          const { data } = await db.from('orders').select('number').eq('id', id).maybeSingle();
          if (data) {
            patchState(store, { filter: 'all', q: data.number, page: 1 });
            await load();
          }
        }
        patchState(store, { expandedId: id });
      },

      toggle(id: number): void {
        patchState(store, { expandedId: store.expandedId() === id ? null : id });
      },

      /** Staff-confirmed courier price; the order total is recalculated in the database. */
      async setShipping(order: AdminOrder, price: number): Promise<boolean> {
        return busy.track(async () => {
          const { error } = await db.rpc('set_order_shipping', { p_order_id: order.id, p_shipping_price: price });
          if (error) {
            toast.error('Цената на доставката не беше запазена.');
            return false;
          }
          toast.success(`${order.number}: доставката е записана.`);
          const shipping = Math.round(price * 100) / 100;
          patchState(store, {
            orders: store.orders().map((o) =>
              o.id === order.id ? { ...o, shipping_price: shipping, total: Math.round((o.subtotal + shipping) * 100) / 100 } : o,
            ),
          });
          return true;
        }, 'Запис на доставката…');
      },

      async setStatus(order: AdminOrder, status: OrderStatus, trackingNumber?: string): Promise<void> {
        return busy.track(async () => {
          const { error } = await db.rpc('set_order_status', {
            p_order_id: order.id,
            p_status: status,
            p_tracking_number: trackingNumber?.trim() || undefined,
          });
          if (error) {
            toast.error('Статусът не беше променен.');
            return;
          }
          // Marking an order shipped queues the tracking e-mail; this sends it
          if (status === 'shipped') void db.functions.invoke('order-emails');
          toast.success(`${order.number}: ${ORDER_STATUS_LABEL[status].toLowerCase()}.`);
          patchState(store, {
            orders: store.orders().map((o) =>
              o.id === order.id ? { ...o, status, tracking_number: trackingNumber?.trim() || o.tracking_number } : o,
            ),
          });
        }, 'Смяна на статуса…');
      },
    };
  }),
);
