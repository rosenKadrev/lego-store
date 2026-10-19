import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { ItemCondition } from '../core/models';
import { Supabase } from '../core/supabase';

export type PartFilterOption = { id: number; name: string; rgb: string | null; listing_count: number; sample_img_url: string | null };
type PartFilterCount = PartFilterOption & { kind: 'category' | 'color'; condition: ItemCondition };

type State = {
  counts: PartFilterCount[];
  loaded: boolean;
};

/** Sums the per-condition rows of one kind, most listings first */
function options(counts: PartFilterCount[], kind: PartFilterCount['kind'], condition: ItemCondition | null): PartFilterOption[] {
  const byId = new Map<number, PartFilterOption>();
  for (const c of counts) {
    if (c.kind !== kind || (condition && c.condition !== condition)) continue;
    const option = byId.get(c.id);
    if (option) {
      option.listing_count += c.listing_count;
      option.sample_img_url ??= c.sample_img_url;
    } else byId.set(c.id, { id: c.id, name: c.name, rgb: c.rgb, listing_count: c.listing_count, sample_img_url: c.sample_img_url });
  }
  return [...byId.values()].sort((a, b) => b.listing_count - a.listing_count || a.name.localeCompare(b.name));
}

/** Categories and colours that currently have parts for sale (shop filters). */
export const PartFiltersStore = signalStore(
  { providedIn: 'root' },
  withState<State>({ counts: [], loaded: false }),
  withMethods((store, supabase = inject(Supabase)) => ({
    /** `force` re-reads the filters (after listings changed or when the catalog opens). */
    async load(force = false): Promise<void> {
      if (store.loaded() && !force) return;
      const { data } = await supabase.client.rpc('listed_part_filter_counts');
      patchState(store, { counts: (data ?? []) as PartFilterCount[], loaded: true });
    },
    /** Categories with parts for sale in that condition (any when null), counted the same way */
    categories(condition: ItemCondition | null = null): PartFilterOption[] {
      return options(store.counts(), 'category', condition);
    },
    colors(condition: ItemCondition | null = null): PartFilterOption[] {
      return options(store.counts(), 'color', condition);
    },
  })),
);
