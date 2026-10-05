import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { CatalogListing, ItemCondition, ItemType } from '../core/models';
import { Supabase } from '../core/supabase';
import { ShopLists } from '../stores/shop-lists';
import { ToastStore } from '../stores/toast.store';

export type AdminListingFilters = {
  q: string;
  condition: ItemCondition | null;
  type: ItemType | null;
  status: 'all' | 'published' | 'draft' | 'sold_out';
};

const PAGE_SIZE = 50;

type State = {
  filters: AdminListingFilters;
  items: CatalogListing[];
  total: number;
  page: number;
  loading: boolean;
};

export const AdminListingsStore = signalStore(
  withState<State>({
    filters: { q: '', condition: null, type: null, status: 'all' },
    items: [],
    total: 0,
    page: 1,
    loading: true,
  }),
  withMethods((store, supabase = inject(Supabase), toast = inject(ToastStore), shopLists = inject(ShopLists)) => {
    const db = supabase.client;
    let requestId = 0;

    async function load(): Promise<void> {
      const id = ++requestId;
      patchState(store, { loading: true });
      const f = store.filters();
      let query = db.from('catalog_listings').select('*', { count: 'exact' });
      if (f.condition) query = query.eq('condition', f.condition);
      if (f.type) query = query.eq('item_type', f.type);
      if (f.status === 'published') query = query.eq('is_published', true);
      if (f.status === 'draft') query = query.eq('is_published', false);
      if (f.status === 'sold_out') query = query.eq('stock', 0);
      const q = f.q.trim().replace(/[,()*%]/g, ' ').trim();
      if (q) query = query.or(`name.ilike.*${q}*,item_num.ilike.${q}*`);
      const from = (store.page() - 1) * PAGE_SIZE;
      const { data, count } = await query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (id !== requestId) return;
      patchState(store, { items: data ?? [], total: count ?? 0, loading: false });
    }

    function patchItem(id: number, changes: Partial<CatalogListing>): void {
      patchState(store, { items: store.items().map((i) => (i.id === id ? { ...i, ...changes } : i)) });
    }

    return {
      load,
      pageSize: () => PAGE_SIZE,

      setFilters(changes: Partial<AdminListingFilters>): void {
        patchState(store, { filters: { ...store.filters(), ...changes }, page: 1 });
        void load();
      },

      setPage(page: number): void {
        patchState(store, { page });
        void load();
      },

      async setStock(id: number, stock: number): Promise<void> {
        patchItem(id, { stock });
        const { error } = await db.from('listings').update({ stock }).eq('id', id);
        if (error) {
          toast.error('Наличността не беше запазена.');
          void load();
          return;
        }
        shopLists.refresh(); // a listing that runs out (or comes back) changes the theme lists
      },

      async togglePublished(listing: CatalogListing): Promise<void> {
        const is_published = !listing.is_published;
        patchItem(listing.id!, { is_published });
        const { error } = await db.from('listings').update({ is_published }).eq('id', listing.id!);
        if (error) {
          toast.error('Промяната не беше запазена.');
          void load();
          return;
        }
        shopLists.refresh();
        toast.success(is_published ? `„${listing.name}“ е публикувана.` : `„${listing.name}“ е скрита от магазина.`);
      },
    };
  }),
);
