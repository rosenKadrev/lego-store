import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Supabase } from '../core/supabase';

export type PartFilterOption = { id: number; name: string; rgb: string | null; listing_count: number };

type State = {
  categories: PartFilterOption[];
  colors: PartFilterOption[];
  loaded: boolean;
};

/** Categories and colours that currently have parts for sale (shop filters). */
export const PartFiltersStore = signalStore(
  { providedIn: 'root' },
  withState<State>({ categories: [], colors: [], loaded: false }),
  withMethods((store, supabase = inject(Supabase)) => ({
    async load(): Promise<void> {
      if (store.loaded()) return;
      const { data } = await supabase.client.rpc('listed_part_filters');
      const rows = (data ?? []) as (PartFilterOption & { kind: 'category' | 'color' })[];
      patchState(store, {
        categories: rows.filter((r) => r.kind === 'category'),
        colors: rows.filter((r) => r.kind === 'color'),
        loaded: true,
      });
    },
  })),
);
