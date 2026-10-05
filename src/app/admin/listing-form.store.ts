import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { CatalogListing, ItemType, Listing, ListingImage } from '../core/models';
import { LISTING_IMAGES_BUCKET, Supabase } from '../core/supabase';

/** A set, minifig or part from the Rebrickable catalog. Parts also need a colour before saving. */
export type CatalogItem = {
  type: ItemType;
  num: string;
  name: string;
  img_url: string | null;
  year: number | null;
  num_parts: number;
  /** theme for sets, category for parts */
  theme_name: string | null;
  color_id?: number | null;
  color_name?: string | null;
  color_rgb?: string | null;
};

/** A colour option for the chosen part; `known` = seen in a set inventory (has a photo). */
export type PartColorOption = { id: number; name: string; rgb: string; is_trans: boolean; img_url: string | null; known: boolean };

export type ListingDraft = Omit<Listing, 'id' | 'created_at' | 'updated_at'>;

type State = {
  listing: Listing | null;
  item: CatalogItem | null;
  images: ListingImage[];
  results: CatalogItem[];
  searching: boolean;
  existingOffers: CatalogListing[];
  partColors: PartColorOption[];
  allColors: PartColorOption[];
  loading: boolean;
  saving: boolean;
  uploading: boolean;
  error: string | null;
};

const initialState: State = {
  listing: null,
  item: null,
  images: [],
  results: [],
  searching: false,
  existingOffers: [],
  partColors: [],
  allColors: [],
  loading: false,
  saving: false,
  uploading: false,
  error: null,
};

export const ListingFormStore = signalStore(
  withState<State>(initialState),
  withMethods((store, supabase = inject(Supabase)) => {
    const db = supabase.client;
    let searchId = 0;

    async function loadItem(type: ItemType, num: string, colorId?: number | null): Promise<CatalogItem | null> {
      if (type === 'part') {
        const { data } = await db.from('parts').select('*, part_categories(name)').eq('part_num', num).maybeSingle();
        if (!data) return null;
        const item: CatalogItem = {
          type, num, name: data.name, img_url: data.img_url, year: null, num_parts: 1, theme_name: data.part_categories?.name ?? null,
        };
        if (colorId == null) return item;
        const [{ data: color }, { data: pc }] = await Promise.all([
          db.from('colors').select('*').eq('id', colorId).maybeSingle(),
          db.from('part_colors').select('img_url').eq('part_num', num).eq('color_id', colorId).maybeSingle(),
        ]);
        return { ...item, color_id: colorId, color_name: color?.name ?? null, color_rgb: color?.rgb ?? null, img_url: pc?.img_url ?? item.img_url };
      }
      if (type === 'set') {
        const { data } = await db.from('sets').select('*, themes(name)').eq('set_num', num).maybeSingle();
        return data ? { type, num, name: data.name, img_url: data.img_url, year: data.year, num_parts: data.num_parts, theme_name: data.themes?.name ?? null } : null;
      }
      const { data } = await db.from('minifigs').select('*').eq('fig_num', num).maybeSingle();
      return data ? { type, num, name: data.name, img_url: data.img_url, year: null, num_parts: data.num_parts, theme_name: null } : null;
    }

    async function loadExistingOffers(num: string, exceptId?: number, colorId?: number | null): Promise<void> {
      let query = db.from('catalog_listings').select('*').eq('item_num', num);
      if (colorId != null) query = query.eq('color_id', colorId);
      if (exceptId) query = query.neq('id', exceptId);
      const { data } = await query.order('condition');
      patchState(store, { existingOffers: data ?? [] });
    }

    async function loadImages(listingId: number): Promise<void> {
      const { data } = await db.from('listing_images').select('*').eq('listing_id', listingId).order('sort_order').order('id');
      patchState(store, { images: data ?? [] });
    }

    return {
      reset(): void {
        patchState(store, initialState);
      },

      async load(id: number): Promise<void> {
        patchState(store, { ...initialState, loading: true });
        const { data: listing } = await db.from('listings').select('*').eq('id', id).maybeSingle();
        if (!listing) {
          patchState(store, { loading: false, error: 'Обявата не е намерена.' });
          return;
        }
        const num = (listing.set_num ?? listing.fig_num ?? listing.part_num)!;
        const item = await loadItem(listing.item_type, num, listing.color_id);
        patchState(store, { listing, item, loading: false });
        await Promise.all([loadImages(id), loadExistingOffers(num, id, listing.color_id)]);
      },

      async search(type: ItemType, q: string): Promise<void> {
        const id = ++searchId;
        const term = q.trim().replace(/[,()*%]/g, ' ').trim();
        if (term.length < 2) {
          patchState(store, { results: [], searching: false });
          return;
        }
        patchState(store, { searching: true });
        let results: CatalogItem[];
        if (type === 'set') {
          const { data } = await db
            .from('sets')
            .select('*, themes(name)')
            .or(`set_num.ilike.${term}*,name.ilike.*${term}*`)
            .order('year', { ascending: false })
            .limit(15);
          results = (data ?? []).map((s) => ({
            type, num: s.set_num, name: s.name, img_url: s.img_url, year: s.year, num_parts: s.num_parts, theme_name: s.themes?.name ?? null,
          }));
        } else if (type === 'part') {
          // Element IDs (6–7 digits) identify part + colour directly
          const byElement = /^\d{6,8}$/.test(term)
            ? (await db.from('elements').select('part_num, color_id').eq('element_id', term).maybeSingle()).data
            : null;
          const { data } = await db
            .from('parts')
            .select('*, part_categories(name)')
            .or(`part_num.ilike.${term}*,name.ilike.*${term}*`)
            .order('part_num')
            .limit(20);
          results = (data ?? []).map((p) => ({
            type, num: p.part_num, name: p.name, img_url: p.img_url, year: null, num_parts: 1, theme_name: p.part_categories?.name ?? null,
          }));
          if (byElement) {
            const item = await loadItem('part', byElement.part_num, byElement.color_id);
            if (item) results = [item, ...results.filter((r) => r.num !== item.num)];
          }
        } else {
          const { data } = await db
            .from('minifigs')
            .select('*')
            .or(`fig_num.ilike.*${term}*,name.ilike.*${term}*`)
            .limit(15);
          results = (data ?? []).map((m) => ({
            type, num: m.fig_num, name: m.name, img_url: m.img_url, year: null, num_parts: m.num_parts, theme_name: null,
          }));
        }
        if (id !== searchId) return;
        patchState(store, { results, searching: false });
      },

      /** Fetches a set/minifig missing from our catalog from the Rebrickable API (Edge Function) and selects it. */
      async lookupRebrickable(type: ItemType, num: string): Promise<void> {
        patchState(store, { searching: true, error: null });
        const { data, error } = await db.functions.invoke<{ item?: CatalogItem; error?: string }>('rebrickable-lookup', {
          body: { type, num: num.trim() },
        });
        patchState(store, { searching: false });
        if (error || !data?.item) {
          // FunctionsHttpError carries the function's JSON body in `context`
          const body = await (error as { context?: Response } | null)?.context?.json?.().catch(() => null);
          patchState(store, { error: body?.error ?? data?.error ?? 'Търсенето в Rebrickable не успя.' });
          return;
        }
        patchState(store, { item: data.item, results: [] });
        await loadExistingOffers(data.item.num);
      },

      async selectItem(item: CatalogItem | null): Promise<void> {
        patchState(store, { item, results: [], existingOffers: [], partColors: [] });
        if (!item) return;
        if (item.type === 'part' && item.color_id == null) {
          await this.loadPartColors(item.num);
          return;
        }
        await loadExistingOffers(item.num, undefined, item.color_id);
      },

      /** Colours for a part: ones seen in sets first (with photos), then every other colour. */
      async loadPartColors(partNum: string): Promise<void> {
        const [{ data: known }, all] = await Promise.all([
          db.from('part_colors').select('img_url, colors(id, name, rgb, is_trans)').eq('part_num', partNum),
          store.allColors().length
            ? Promise.resolve(store.allColors())
            : db.from('colors').select('*').gte('id', 0).order('name').then(({ data }) =>
                (data ?? []).map((c) => ({ ...c, img_url: null, known: false })),
              ),
        ]);
        const partColors = (known ?? [])
          .flatMap((row) => (row.colors ? [{ ...row.colors, img_url: row.img_url, known: true }] : []))
          .sort((a, b) => a.name.localeCompare(b.name));
        patchState(store, { partColors, allColors: all });
      },

      async chooseColor(color: PartColorOption): Promise<void> {
        const item = store.item();
        if (!item) return;
        patchState(store, {
          item: { ...item, color_id: color.id, color_name: color.name, color_rgb: color.rgb, img_url: color.img_url ?? item.img_url },
        });
        await loadExistingOffers(item.num, store.listing()?.id, color.id);
      },

      /** Creates or updates the listing; returns its id on success. */
      async save(draft: ListingDraft): Promise<number | null> {
        patchState(store, { saving: true, error: null });
        const current = store.listing();
        const { data, error } = current
          ? await db.from('listings').update(draft).eq('id', current.id).select().single()
          : await db.from('listings').insert(draft).select().single();
        patchState(store, { saving: false });
        if (error) {
          patchState(store, { error: `Грешка при запис: ${error.message}` });
          return null;
        }
        patchState(store, { listing: data });
        return data.id;
      },

      async remove(): Promise<boolean> {
        const current = store.listing();
        if (!current) return false;
        const { error } = await db.from('listings').delete().eq('id', current.id);
        if (error) {
          patchState(store, {
            error: error.code === '23503' ? 'Обявата има поръчки и не може да бъде изтрита. Скрийте я вместо това.' : error.message,
          });
          return false;
        }
        const paths = store.images().map((i) => i.path);
        if (paths.length) await db.storage.from(LISTING_IMAGES_BUCKET).remove(paths);
        return true;
      },

      async upload(files: FileList | File[]): Promise<void> {
        const listing = store.listing();
        if (!listing) return;
        patchState(store, { uploading: true, error: null });
        let order = Math.max(-1, ...store.images().map((i) => i.sort_order)) + 1;
        for (const file of Array.from(files)) {
          const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
          const path = `${listing.id}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await db.storage
            .from(LISTING_IMAGES_BUCKET)
            .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
          if (uploadError) {
            patchState(store, { error: `${file.name}: ${uploadError.message}` });
            continue;
          }
          await db.from('listing_images').insert({ listing_id: listing.id, path, sort_order: order++ });
        }
        await loadImages(listing.id);
        patchState(store, { uploading: false });
      },

      async deleteImage(image: ListingImage): Promise<void> {
        await db.from('listing_images').delete().eq('id', image.id);
        await db.storage.from(LISTING_IMAGES_BUCKET).remove([image.path]);
        patchState(store, { images: store.images().filter((i) => i.id !== image.id) });
      },

      /** Moves an image one position left/right and renumbers all sort orders. */
      async moveImage(index: number, direction: -1 | 1): Promise<void> {
        const images = [...store.images()];
        const target = index + direction;
        if (target < 0 || target >= images.length) return;
        [images[index], images[target]] = [images[target], images[index]];
        const renumbered = images.map((img, i) => ({ ...img, sort_order: i }));
        patchState(store, { images: renumbered });
        await Promise.all(
          renumbered.map((img) => db.from('listing_images').update({ sort_order: img.sort_order }).eq('id', img.id)),
        );
      },
    };
  }),
);
