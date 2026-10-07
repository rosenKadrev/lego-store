import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { CatalogListing, ItemCondition, ItemType, searchFilter } from '../core/models';
import { Supabase } from '../core/supabase';
import { ThemesStore } from './themes.store';

export type CatalogSort = 'newest' | 'price_asc' | 'price_desc' | 'name';

export type CatalogFilters = {
  condition: ItemCondition | null;
  type: ItemType | null;
  theme: number | null;
  /** parts only */
  color: number | null;
  category: number | null;
  /** price range in € (inclusive) */
  minPrice: number | null;
  maxPrice: number | null;
  q: string;
  sort: CatalogSort;
  page: number;
};

export const EMPTY_FILTERS: CatalogFilters = {
  condition: null,
  type: null,
  theme: null,
  color: null,
  category: null,
  minPrice: null,
  maxPrice: null,
  q: '',
  sort: 'newest',
  page: 1,
};

export const PAGE_SIZE = 24;

type CatalogState = {
  filters: CatalogFilters;
  items: CatalogListing[];
  total: number;
  loading: boolean;
  error: string | null;
};

export const CatalogStore = signalStore(
  { providedIn: 'root' },
  withState<CatalogState>({ filters: EMPTY_FILTERS, items: [], total: 0, loading: false, error: null }),
  withComputed(({ total, filters }) => ({
    pageCount: computed(() => Math.max(1, Math.ceil(total() / PAGE_SIZE))),
    hasFilters: computed(() => {
      const f = filters();
      return !!(f.condition || f.type || f.theme || f.color || f.category || f.q || f.minPrice != null || f.maxPrice != null);
    }),
  })),
  withMethods((store, supabase = inject(Supabase), themes = inject(ThemesStore)) => {
    let requestId = 0;

    return {
      async load(filters: CatalogFilters): Promise<void> {
        const id = ++requestId;
        patchState(store, { filters, loading: true, error: null });

        if (filters.theme != null) await themes.load();

        let query = supabase.client
          .from('catalog_listings')
          .select('*', { count: 'exact' })
          .eq('is_published', true)
          .gt('stock', 0);

        if (filters.condition) query = query.eq('condition', filters.condition);
        if (filters.type) query = query.eq('item_type', filters.type);
        if (filters.theme != null) query = query.in('theme_id', themes.withDescendants(filters.theme));
        if (filters.color != null) query = query.eq('color_id', filters.color);
        if (filters.category != null) query = query.eq('part_cat_id', filters.category);
        if (filters.minPrice != null) query = query.gte('price', filters.minPrice);
        if (filters.maxPrice != null) query = query.lte('price', filters.maxPrice);

        const q = filters.q.trim().replace(/[,()*%]/g, ' ').trim();
        if (q) query = query.or(searchFilter(q));

        switch (filters.sort) {
          case 'price_asc':
            query = query.order('price', { ascending: true });
            break;
          case 'price_desc':
            query = query.order('price', { ascending: false });
            break;
          case 'name':
            query = query.order('name', { ascending: true });
            break;
          default:
            query = query.order('created_at', { ascending: false });
        }

        const from = (filters.page - 1) * PAGE_SIZE;
        const { data, count, error } = await query.order('id').range(from, from + PAGE_SIZE - 1);

        if (id !== requestId) return; // a newer request already started
        patchState(store, {
          items: data ?? [],
          total: count ?? 0,
          loading: false,
          error: error ? 'Възникна грешка при зареждането. Опитайте отново.' : null,
        });
      },
    };
  }),
);
