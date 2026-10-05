import { inject, Injectable } from '@angular/core';
import { PartFiltersStore } from './part-filters.store';
import { ThemesStore } from './themes.store';

/** Re-reads the navigation lists that depend on which listings are for sale (themes, part filters). */
@Injectable({ providedIn: 'root' })
export class ShopLists {
  private readonly themes = inject(ThemesStore);
  private readonly partFilters = inject(PartFiltersStore);

  refresh(): void {
    void this.themes.refreshListed();
    void this.partFilters.load(true);
  }
}
