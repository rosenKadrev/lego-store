import { DestroyRef, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { Supabase } from '../core/supabase';

type ListingStockRow = { id: number; stock: number; is_published: boolean };

/**
 * Live stock from Supabase Realtime (see migration 20261007140000_listings_realtime.sql).
 * Holds the latest known stock per listing id; anything not updated since the page loaded
 * falls back to the stock the listing was fetched with.
 */
export const LiveStockStore = signalStore(
  { providedIn: 'root' },
  withState({ stock: {} as Record<number, number> }),
  withMethods((store) => ({
    stockOf(listing: { id: number | null; stock: number | null }): number {
      const live = listing.id != null ? store.stock()[listing.id] : undefined;
      return live ?? listing.stock ?? 0;
    },
  })),
  withHooks({
    onInit(store) {
      const db = inject(Supabase).client;
      const channel = db
        .channel('listing-stock')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listings' }, (payload) => {
          const row = payload.new as ListingStockRow;
          // An unpublished listing can't be bought any more
          patchState(store, { stock: { ...store.stock(), [row.id]: row.is_published ? row.stock : 0 } });
        })
        .subscribe();
      inject(DestroyRef).onDestroy(() => void db.removeChannel(channel));
    },
  }),
);
