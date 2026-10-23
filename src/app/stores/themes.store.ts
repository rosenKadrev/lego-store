import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { ItemCondition, ItemType, Theme } from '../core/models';
import { Supabase } from '../core/supabase';

/** How many themes the header menu / catalog sidebar show before "Виж всички" */
export const MENU_THEME_LIMIT = 10;
export const SIDEBAR_THEME_LIMIT = 8;

export type ListedTheme = {
  theme_id: number;
  name: string;
  listing_count: number;
  /** A set of the theme (Rebrickable photo) */
  sample_img_url: string | null;
  /** A minifig of the theme (Rebrickable photo) */
  minifig_img_url: string | null;
  /** The newest magazine of the theme: the shop's own photo, a path in the listing-images bucket */
  magazine_cover_path: string | null;
  /** The newest minifig of the theme with the shop's own photo — for figures without (or with a broken) Rebrickable image */
  minifig_cover_path: string | null;
};

/** A theme's picture; `photo` is the shop's own photo (not a cut-out on white, so no blend) */
export type ThemeImage = { src: string; photo: boolean };

/** Listings for sale per top-level theme, by kind and condition (catalog sidebar counts) */
export type ThemeCount = { theme_id: number; item_type: ItemType; condition: ItemCondition; listing_count: number };

type ThemesState = {
  themes: Theme[];
  listed: ListedTheme[];
  counts: ThemeCount[];
  loaded: boolean;
};

export const ThemesStore = signalStore(
  { providedIn: 'root' },
  withState<ThemesState>({ themes: [], listed: [], counts: [], loaded: false }),
  withComputed(({ themes }) => {
    const byId = computed(() => new Map(themes().map((t) => [t.id, t])));
    const children = computed(() => {
      const map = new Map<number, Theme[]>();
      for (const t of themes()) {
        if (t.parent_id == null) continue;
        const list = map.get(t.parent_id) ?? [];
        list.push(t);
        map.set(t.parent_id, list);
      }
      return map;
    });
    return { byId, children };
  }),
  withMethods((store, supabase = inject(Supabase)) => ({
    /** The full theme tree rarely changes: loaded once per visit. */
    async load(): Promise<void> {
      if (store.loaded()) return;
      const [themes] = await Promise.all([
        supabase.client.from('themes').select('*').order('name'),
        this.refreshListed(),
      ]);
      patchState(store, { themes: themes.data ?? [], loaded: true });
    },

    /** Themes that currently have listings for sale — re-read whenever listings may have changed. */
    async refreshListed(): Promise<void> {
      const [listed, counts] = await Promise.all([
        supabase.client.rpc('listed_root_themes'),
        supabase.client.rpc('listed_root_theme_counts'),
      ]);
      if (listed.data) patchState(store, { listed: listed.data as ListedTheme[] });
      if (counts.data) patchState(store, { counts: counts.data as ThemeCount[] });
    },

    /** Top-level themes with something of that kind for sale (in that condition; any when null), counted the same way, most first */
    listedFor(type: ItemType | null, condition: ItemCondition | null = null): ListedTheme[] {
      const counts = new Map<number, number>();
      for (const c of store.counts()) {
        if ((type && c.item_type !== type) || (condition && c.condition !== condition)) continue;
        counts.set(c.theme_id, (counts.get(c.theme_id) ?? 0) + c.listing_count);
      }
      return store
        .listed()
        .flatMap((t) => (counts.get(t.theme_id) ? [{ ...t, listing_count: counts.get(t.theme_id)! }] : []))
        .sort((a, b) => b.listing_count - a.listing_count || a.name.localeCompare(b.name));
    },

    /**
     * Pictures for a theme card, best first (ThemeThumb shows the first one that loads): a minifig / magazine
     * of the theme on those pages, otherwise a set (or whatever there is).
     */
    images(theme: ListedTheme, kind: ItemType | null = null): ThemeImage[] {
      const own = (path: string | null) => (path ? { src: supabase.listingImageUrl(path), photo: true } : null);
      const set = theme.sample_img_url ? { src: theme.sample_img_url, photo: false } : null;
      const minifig = theme.minifig_img_url ? { src: theme.minifig_img_url, photo: false } : null;
      const minifigPhoto = own(theme.minifig_cover_path);
      const magazine = own(theme.magazine_cover_path);
      const order =
        kind === 'minifig' ? [minifig, minifigPhoto, set] : kind === 'magazine' ? [magazine, set] : [set, minifig, minifigPhoto, magazine];
      return order.filter((img): img is ThemeImage => !!img);
    },

    /** The theme itself plus all nested sub-themes, for filtering. */
    withDescendants(themeId: number): number[] {
      const result: number[] = [];
      const stack = [themeId];
      while (stack.length) {
        const id = stack.pop()!;
        result.push(id);
        for (const child of store.children().get(id) ?? []) stack.push(child.id);
      }
      return result;
    },

    /** Breadcrumb from the top-level theme down to `themeId`. */
    path(themeId: number | null | undefined): Theme[] {
      const path: Theme[] = [];
      let current = themeId != null ? store.byId().get(themeId) : undefined;
      while (current) {
        path.unshift(current);
        current = current.parent_id != null ? store.byId().get(current.parent_id) : undefined;
      }
      return path;
    },
  })),
  withHooks({
    onInit(store) {
      void store.load();
    },
  }),
);
