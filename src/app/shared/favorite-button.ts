import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CatalogListing } from '../core/models';
import { favoriteKey, FavoritesStore } from '../stores/favorites.store';
import { Icon } from './icon';

/** Heart toggle for a listing's catalog item (see FavoritesStore). */
@Component({
  selector: 'app-favorite-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <button
      type="button"
      class="grid place-items-center rounded-full transition"
      [class]="classes()"
      [attr.aria-pressed]="active()"
      [attr.aria-label]="(active() ? 'Премахни от любими: ' : 'Добави в любими: ') + listing().name"
      [attr.title]="active() ? 'Премахни от любими' : 'Добави в любими'"
      (click)="favorites.toggle(listing())"
    >
      <app-icon name="heart" [size]="large() ? 22 : 18" [filled]="active()" />
    </button>
  `,
})
export class FavoriteButton {
  protected readonly favorites = inject(FavoritesStore);

  readonly listing = input.required<CatalogListing>();
  /** Product-page size (outlined); default is the small chip over a product photo */
  readonly large = input(false);

  protected readonly active = computed(() => this.favorites.keys().has(favoriteKey(this.listing())));
  protected readonly classes = computed(() => {
    // The small one sits on the always-light photo well, so it keeps light colours in dark mode
    // Hover previews the "favourited" red; press gives a small squeeze
    const base = this.large()
      ? 'size-11 border border-line-strong bg-surface hover:border-accent hover:text-accent'
      : 'size-9 bg-white/90 shadow-sm backdrop-blur hover:scale-110 hover:bg-white hover:text-brick-600 hover:shadow-md';
    const color = this.active() ? (this.large() ? 'text-accent' : 'text-brick-600') : this.large() ? 'text-fg' : 'text-ink-900';
    return `${base} ${color} active:scale-95`;
  });
}
