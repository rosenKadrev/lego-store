import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { CatalogListing, ListingImage } from '../core/models';
import { PageLoading } from '../core/page-loading';
import { Supabase } from '../core/supabase';

export type RelatedFig = { fig_num: string; name: string; img_url: string | null; quantity: number };

type ProductState = {
  listing: CatalogListing | null;
  images: ListingImage[];
  minifigs: RelatedFig[];
  otherOffers: CatalogListing[];
  /** "Още от …" under the product: other products of the same top-level theme (parts: same category) */
  related: CatalogListing[];
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
    related: [],
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
  withMethods((store, supabase = inject(Supabase), pageLoading = inject(PageLoading)) => ({
    async load(id: number): Promise<void> {
      patchState(store, { loading: true, notFound: false, images: [], minifigs: [], otherOffers: [], related: [] });
      const db = supabase.client;

      const { data: listing } = await pageLoading.track(db.from('catalog_listings').select('*').eq('id', id).maybeSingle());
      if (!listing) {
        patchState(store, { listing: null, loading: false, notFound: true });
        return;
      }

      const itemNum = listing.item_num!;
      const isSet = listing.item_type === 'set';
      const [images, figs, offers] = await pageLoading.track(Promise.all([
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
      ]));

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

    /** Other products of these themes (or this part category), newest first; offers of the same item excluded. */
    async loadRelated(listing: CatalogListing, themeIds: number[]): Promise<void> {
      let query = supabase.client
        .from('catalog_listings')
        .select('*')
        .eq('is_published', true)
        .gt('stock', 0)
        .neq('item_num', listing.item_num!);
      if (themeIds.length) query = query.in('theme_id', themeIds);
      else if (listing.part_cat_id != null) query = query.eq('part_cat_id', listing.part_cat_id);
      else return;
      const { data } = await query.order('created_at', { ascending: false }).limit(12);
      if (store.listing()?.id === listing.id) patchState(store, { related: data ?? [] });
    },
  })),
);
