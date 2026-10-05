import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Theme } from '../core/models';
import { Supabase } from '../core/supabase';

/** How many themes the header menu / catalog sidebar show before "Виж всички" */
export const MENU_THEME_LIMIT = 10;
export const SIDEBAR_THEME_LIMIT = 8;

export type ListedTheme = {
  theme_id: number;
  name: string;
  listing_count: number;
  sample_img_url: string | null;
};

type ThemesState = {
  themes: Theme[];
  listed: ListedTheme[];
  loaded: boolean;
};

export const ThemesStore = signalStore(
  { providedIn: 'root' },
  withState<ThemesState>({ themes: [], listed: [], loaded: false }),
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
      const { data } = await supabase.client.rpc('listed_root_themes');
      if (data) patchState(store, { listed: data as ListedTheme[] });
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
