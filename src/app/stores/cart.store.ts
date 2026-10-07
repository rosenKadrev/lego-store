import { computed, effect, inject, untracked } from '@angular/core';
import {
  patchState,
  signalStore,
  watchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { LocalStorage } from '../core/local-storage';
import { BOX_DAMAGED_LABEL, CatalogListing, DeliveryType, ItemCondition, ShopSettings } from '../core/models';
import { Supabase } from '../core/supabase';
import { LiveStockStore } from './live-stock.store';
import { ToastStore } from './toast.store';

export type CartItem = {
  listingId: number;
  name: string;
  itemNum: string;
  condition: ItemCondition;
  price: number;
  imageUrl: string | null;
  quantity: number;
  maxStock: number;
};

type CartState = {
  items: CartItem[];
  settings: ShopSettings | null;
  drawerOpen: boolean;
  /** Set while this browser places its own order, so its own stock updates aren't reported as "sold" */
  liveUpdatesPaused: boolean;
};

const STORAGE_KEY = 'brickstore.cart.v1';

export const CartStore = signalStore(
  { providedIn: 'root' },
  withState<CartState>({ items: [], settings: null, drawerOpen: false, liveUpdatesPaused: false }),
  withComputed(({ items }) => ({
    count: computed(() => items().reduce((sum, item) => sum + item.quantity, 0)),
    subtotal: computed(() => round2(items().reduce((sum, item) => sum + item.price * item.quantity, 0))),
  })),
  withMethods((store, supabase = inject(Supabase)) => ({
    /** Pickup is free; courier delivery is priced by staff when confirming the order (`null`). */
    shippingFor(delivery: DeliveryType): number | null {
      return delivery === 'pickup' ? 0 : null;
    },

    quantityOf(listingId: number): number {
      return store.items().find((i) => i.listingId === listingId)?.quantity ?? 0;
    },

    add(listing: CatalogListing, imageUrl: string | null, quantity = 1): void {
      if (listing.id == null) return;
      const maxStock = listing.stock ?? 0;
      const existing = store.items().find((i) => i.listingId === listing.id);
      if (existing) {
        patchState(store, {
          items: store.items().map((i) =>
            i.listingId === listing.id ? { ...i, quantity: Math.min(i.quantity + quantity, maxStock) } : i,
          ),
          drawerOpen: true,
        });
        return;
      }
      const item: CartItem = {
        listingId: listing.id,
        name: listing.color_name
          ? `${listing.name} — ${listing.color_name}`
          : `${listing.name ?? ''}${listing.box_damaged ? ` (${BOX_DAMAGED_LABEL.toLowerCase()})` : ''}`,
        itemNum: listing.item_num ?? '',
        condition: listing.condition ?? 'new',
        price: listing.price ?? 0,
        imageUrl,
        quantity: Math.min(quantity, maxStock),
        maxStock,
      };
      patchState(store, { items: [...store.items(), item], drawerOpen: true });
    },

    setQuantity(listingId: number, quantity: number): void {
      patchState(store, {
        items: store
          .items()
          .map((i) => (i.listingId === listingId ? { ...i, quantity: Math.min(Math.max(quantity, 0), i.maxStock) } : i))
          .filter((i) => i.quantity > 0),
      });
    },

    remove(listingId: number): void {
      patchState(store, { items: store.items().filter((i) => i.listingId !== listingId) });
    },

    clear(): void {
      patchState(store, { items: [] });
    },

    pauseLiveUpdates(paused: boolean): void {
      patchState(store, { liveUpdatesPaused: paused });
    },

    openDrawer(): void {
      patchState(store, { drawerOpen: true });
    },

    closeDrawer(): void {
      patchState(store, { drawerOpen: false });
    },

    async loadSettings(): Promise<void> {
      const { data } = await supabase.client.from('shop_settings').select('*').maybeSingle();
      patchState(store, { settings: data });
    },

    /**
     * Re-reads price and stock from the database (before checkout) and returns
     * human-readable notes about anything that changed.
     */
    async refresh(): Promise<string[]> {
      const ids = store.items().map((i) => i.listingId);
      if (!ids.length) return [];
      const { data } = await supabase.client.from('catalog_listings').select('id, price, stock').in('id', ids);
      const current = new Map((data ?? []).map((row) => [row.id, row]));
      const notes: string[] = [];
      const items = store
        .items()
        .map((item) => {
          const row = current.get(item.listingId);
          const stock = row?.stock ?? 0;
          const price = row?.price ?? item.price;
          if (stock === 0) notes.push(`„${item.name}“ вече не е наличен и беше премахнат.`);
          else if (item.quantity > stock) notes.push(`„${item.name}“: наличните бройки са ${stock}.`);
          if (price !== item.price && stock > 0) notes.push(`Цената на „${item.name}“ е променена.`);
          return { ...item, price, maxStock: stock, quantity: Math.min(item.quantity, stock) };
        })
        .filter((i) => i.quantity > 0);
      patchState(store, { items });
      return notes;
    },
  })),
  withHooks({
    onInit(store) {
      const storage = inject(LocalStorage);
      const saved = storage.get<CartItem[]>(STORAGE_KEY);
      if (Array.isArray(saved)) patchState(store, { items: saved });
      watchState(store, ({ items }) => storage.set(STORAGE_KEY, items));
      void store.loadSettings();

      // Someone else bought what's in this cart: drop sold-out items, trim quantities, tell the buyer
      const liveStock = inject(LiveStockStore);
      const toast = inject(ToastStore);
      effect(() => {
        const live = liveStock.stock();
        untracked(() => {
          if (store.liveUpdatesPaused()) return;
          const items = store.items().flatMap((item) => {
            const stock = live[item.listingId];
            if (stock === undefined || stock === item.maxStock) return [item];
            if (stock === 0) {
              toast.info(`„${item.name}“ току-що беше продаден и е премахнат от количката.`);
              return [];
            }
            if (item.quantity > stock) toast.info(`„${item.name}“: останаха ${stock} бр. — количеството в количката е намалено.`);
            return [{ ...item, maxStock: stock, quantity: Math.min(item.quantity, stock) }];
          });
          patchState(store, { items });
        });
      });
    },
  }),
);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
