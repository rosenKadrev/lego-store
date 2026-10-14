import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { CatalogListing, ItemCondition, ItemType, searchFilter } from '../core/models';
import { PageLoading } from '../core/page-loading';
import { Supabase } from '../core/supabase';
import { ThemesStore } from './themes.store';

export type CatalogSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'name'
  | 'theme'
  | 'year_desc'
  | 'year_asc'
  | 'parts_desc'
  | 'parts_asc'
  | 'color'
  | 'category';

/** Columns to order by for each sort; rows without a value (e.g. no year) go last */
const SORT_ORDER: Record<CatalogSort, [column: keyof CatalogListing, ascending: boolean][]> = {
  newest: [['created_at', false]],
  price_asc: [['price', true]],
  price_desc: [['price', false]],
  name: [['name', true]],
  theme: [['theme_name', true], ['name', true]],
  year_desc: [['year', false], ['name', true]],
  year_asc: [['year', true], ['name', true]],
  parts_desc: [['num_parts', false]],
  parts_asc: [['num_parts', true]],
  color: [['color_name', true], ['name', true]],
  category: [['part_category', true], ['name', true]],
};

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
  withMethods((store, supabase = inject(Supabase), themes = inject(ThemesStore), pageLoading = inject(PageLoading)) => {
    let requestId = 0;

    return {
      async load(filters: CatalogFilters): Promise<void> {
        const id = ++requestId;
        patchState(store, { filters, loading: true, error: null });

        if (filters.theme != null) await pageLoading.track(themes.load());

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

        for (const [column, ascending] of SORT_ORDER[filters.sort]) {
          query = query.order(column, { ascending, nullsFirst: false });
        }

        const from = (filters.page - 1) * PAGE_SIZE;
        const { data, count, error } = await pageLoading.track(query.order('id').range(from, from + PAGE_SIZE - 1));

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
