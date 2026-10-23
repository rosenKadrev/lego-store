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
/** PostgREST returns at most 1000 rows per request; `in (...)` lists are kept short for the URL */
const ID_PAGE = 1000;
const UPDATE_CHUNK = 200;

type State = {
  filters: AdminListingFilters;
  items: CatalogListing[];
  total: number;
  page: number;
  loading: boolean;
  /** Ticked listings (ids) — may span pages; cleared when the filters change */
  selected: number[];
  bulkSaving: boolean;
};

export const AdminListingsStore = signalStore(
  withState<State>({
    filters: { q: '', condition: null, type: null, status: 'all' },
    items: [],
    total: 0,
    page: 1,
    loading: true,
    selected: [],
    bulkSaving: false,
  }),
  withMethods((store, supabase = inject(Supabase), toast = inject(ToastStore), shopLists = inject(ShopLists)) => {
    const db = supabase.client;
    let requestId = 0;

    /** The current filters, for both the page query and "select all matching" */
    function filtered<T extends 'id' | '*'>(columns: T, count?: 'exact') {
      const f = store.filters();
      let query = db.from('catalog_listings').select(columns, count ? { count } : undefined);
      if (f.condition) query = query.eq('condition', f.condition);
      if (f.type) query = query.eq('item_type', f.type);
      if (f.status === 'published') query = query.eq('is_published', true);
      if (f.status === 'draft') query = query.eq('is_published', false);
      if (f.status === 'sold_out') query = query.eq('stock', 0);
      const q = f.q.trim().replace(/[,()*%]/g, ' ').trim();
      if (q) query = query.or(`name.ilike.*${q}*,item_num.ilike.${q}*,bl_num.ilike.${q}*`);
      return query;
    }

    async function load(): Promise<void> {
      const id = ++requestId;
      patchState(store, { loading: true });
      const query = filtered('*', 'exact');
      const from = (store.page() - 1) * PAGE_SIZE;
      const { data, count } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }) // parts imported together share created_at — keep the pages stable
        .range(from, from + PAGE_SIZE - 1);
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
        patchState(store, { filters: { ...store.filters(), ...changes }, page: 1, selected: [] });
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

      toggleSelected(id: number): void {
        const selected = store.selected();
        patchState(store, { selected: selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id] });
      },

      /** Tick or untick every listing on the current page */
      selectPage(on: boolean): void {
        const pageIds = store.items().map((i) => i.id!);
        const rest = store.selected().filter((s) => !pageIds.includes(s));
        patchState(store, { selected: on ? [...rest, ...pageIds] : rest });
      },

      /** Every listing matching the filters, on all pages */
      async selectAllMatching(): Promise<void> {
        const ids: number[] = [];
        for (let from = 0; ; from += ID_PAGE) {
          const { data, error } = await filtered('id').order('id').range(from, from + ID_PAGE - 1);
          if (error) {
            toast.error('Не успях да избера всички обяви.');
            return;
          }
          ids.push(...(data ?? []).map((r) => r.id!));
          if ((data?.length ?? 0) < ID_PAGE) break;
        }
        patchState(store, { selected: ids });
      },

      clearSelection(): void {
        patchState(store, { selected: [] });
      },

      async setPublishedSelected(is_published: boolean): Promise<void> {
        const ids = store.selected();
        if (!ids.length) return;
        patchState(store, { bulkSaving: true });
        let failed = false;
        for (let i = 0; i < ids.length && !failed; i += UPDATE_CHUNK) {
          const { error } = await db.from('listings').update({ is_published }).in('id', ids.slice(i, i + UPDATE_CHUNK));
          failed = !!error;
        }
        patchState(store, { bulkSaving: false });
        shopLists.refresh();
        if (failed) {
          toast.error('Част от промените не бяха запазени.');
        } else {
          patchState(store, { selected: [] });
          toast.success(is_published ? `Публикувани: ${ids.length}.` : `Скрити от магазина: ${ids.length}.`);
        }
        void load();
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
