import { computed, effect, inject, untracked } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { LocalStorage } from '../core/local-storage';
import { CatalogListing } from '../core/models';
import { Supabase } from '../core/supabase';
import { AuthStore } from './auth.store';
import { ToastStore } from './toast.store';

/** Snapshot of a favourite catalog item (see migration 20261006120000_favorites.sql) */
export type Favorite = { key: string; name: string; imageUrl: string | null };

type FavoritesState = { items: Favorite[]; userId: string | null };

const STORAGE_KEY = 'brickstore.favorites.v1';

/**
 * The catalog item a listing sells: 'set:<num>', 'minifig:<num>' or 'part:<num>:<color>'.
 * Favourites use it instead of the listing id so they outlive a sold-out (single-copy) listing.
 */
export function favoriteKey(listing: Pick<CatalogListing, 'item_type' | 'item_num' | 'color_id'>): string {
  return listing.item_type === 'part'
    ? `part:${listing.item_num}:${listing.color_id}`
    : `${listing.item_type}:${listing.item_num}`;
}

/** Wishlist: localStorage for guests, the `favorites` table once logged in (merged on login). */
export const FavoritesStore = signalStore(
  { providedIn: 'root' },
  withState<FavoritesState>({ items: [], userId: null }),
  withComputed(({ items }) => ({
    count: computed(() => items().length),
    keys: computed(() => new Set(items().map((f) => f.key))),
  })),
  withMethods((store, supabase = inject(Supabase), storage = inject(LocalStorage), toast = inject(ToastStore)) => {
    const db = supabase.client;

    function saveLocal(): void {
      if (!store.userId()) storage.set(STORAGE_KEY, store.items());
    }

    async function remove(key: string): Promise<void> {
      patchState(store, { items: store.items().filter((f) => f.key !== key) });
      saveLocal();
      if (store.userId()) await db.from('favorites').delete().eq('item_key', key);
    }

    return {
      remove,

      has(listing: Pick<CatalogListing, 'item_type' | 'item_num' | 'color_id'>): boolean {
        return store.keys().has(favoriteKey(listing));
      },

      async toggle(listing: CatalogListing): Promise<void> {
        const key = favoriteKey(listing);
        if (store.keys().has(key)) return remove(key);
        const favorite: Favorite = {
          key,
          name: listing.color_name ? `${listing.name} — ${listing.color_name}` : (listing.name ?? ''),
          // The catalog picture, not a used copy's photo: the favourite is the item, not that copy
          imageUrl: listing.catalog_img_url ?? supabase.coverUrl(listing),
        };
        patchState(store, { items: [favorite, ...store.items()] });
        saveLocal();
        if (store.userId()) {
          const { error } = await db
            .from('favorites')
            .insert({ item_key: key, name: favorite.name, image_url: favorite.imageUrl });
          if (error) {
            patchState(store, { items: store.items().filter((f) => f.key !== key) });
            toast.error('Не успяхме да запазим любимия продукт. Опитайте пак.');
          }
        }
      },

      /** Switches between the guest list and the account's list; guest favourites are merged in on login. */
      async loadFor(userId: string | null): Promise<void> {
        patchState(store, { userId });
        const local = storage.get<Favorite[]>(STORAGE_KEY) ?? [];
        if (!userId) {
          patchState(store, { items: Array.isArray(local) ? local : [] });
          return;
        }
        if (local.length) {
          const rows = local.map((f) => ({ item_key: f.key, name: f.name, image_url: f.imageUrl }));
          const { error } = await db.from('favorites').upsert(rows, { onConflict: 'user_id,item_key', ignoreDuplicates: true });
          if (!error) storage.set(STORAGE_KEY, []);
        }
        const { data } = await db
          .from('favorites')
          .select('item_key, name, image_url')
          .order('created_at', { ascending: false });
        if (store.userId() !== userId) return; // logged out meanwhile
        patchState(store, {
          items: (data ?? []).map((r) => ({ key: r.item_key, name: r.name, imageUrl: r.image_url })),
        });
      },
    };
  }),
  withHooks({
    onInit(store) {
      const auth = inject(AuthStore);
      let current: string | null | undefined;
      effect(() => {
        if (!auth.initialized()) return;
        const userId = auth.user()?.id ?? null;
        if (userId === current) return; // token refreshes re-emit the same user
        current = userId;
        untracked(() => void store.loadFor(userId));
      });
    },
  }),
);
