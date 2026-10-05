import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { CatalogListing, ListingImage } from '../core/models';
import { Supabase } from '../core/supabase';

export type RelatedFig = { fig_num: string; name: string; img_url: string | null; quantity: number };

type ProductState = {
  listing: CatalogListing | null;
  images: ListingImage[];
  minifigs: RelatedFig[];
  otherOffers: CatalogListing[];
  loading: boolean;
  notFound: boolean;
};

/** Product page state; provided per page so it resets on navigation. */
export const ProductStore = signalStore(
  withState<ProductState>({
    listing: null,
    images: [],
    minifigs: [],
    otherOffers: [],
    loading: true,
    notFound: false,
  }),
  withComputed(({ listing, images }, supabase = inject(Supabase)) => ({
    gallery: computed(() => {
      const l = listing();
      const own = images().map((img) => supabase.listingImageUrl(img.path));
      if (l?.catalog_img_url) own.push(l.catalog_img_url);
      return own;
    }),
  })),
  withMethods((store, supabase = inject(Supabase)) => ({
    async load(id: number): Promise<void> {
      patchState(store, { loading: true, notFound: false, images: [], minifigs: [], otherOffers: [] });
      const db = supabase.client;

      const { data: listing } = await db.from('catalog_listings').select('*').eq('id', id).maybeSingle();
      if (!listing) {
        patchState(store, { listing: null, loading: false, notFound: true });
        return;
      }

      const itemNum = listing.item_num!;
      const isSet = listing.item_type === 'set';
      const [images, figs, offers] = await Promise.all([
        db.from('listing_images').select('*').eq('listing_id', id).order('sort_order'),
        isSet
          ? db.from('set_minifigs').select('quantity, minifigs(fig_num, name, img_url)').eq('set_num', itemNum)
          : Promise.resolve({ data: [] }),
        (listing.color_id != null
          ? db.from('catalog_listings').select('*').eq('color_id', listing.color_id)
          : db.from('catalog_listings').select('*'))
          .eq('item_num', itemNum)
          .eq('is_published', true)
          .gt('stock', 0)
          .neq('id', id)
          .order('price'),
      ]);

      patchState(store, {
        listing,
        images: images.data ?? [],
        minifigs: (figs.data ?? []).flatMap((row) =>
          row.minifigs ? [{ ...row.minifigs, quantity: row.quantity }] : [],
        ),
        otherOffers: offers.data ?? [],
        loading: false,
      });
    },
  })),
);
