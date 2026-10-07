import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogListing, displayItemNum } from '../core/models';
import { Supabase } from '../core/supabase';
import { Icon } from '../shared/icon';
import { ProductCard } from '../shared/product-card';
import { Favorite, favoriteKey, FavoritesStore } from '../stores/favorites.store';

/**
 * Wishlist. Shows every in-stock listing of a favourite item (a set can have new and used copies);
 * favourites with nothing in stock are listed separately and come back once restocked.
 */
@Component({
  selector: 'app-favorites',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ProductCard],
  template: `
    <div class="container-page pt-8">
      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Любими</h1>
      @if (favorites.count()) {
        <p class="mt-1 text-sm text-fg-muted">
          {{ favorites.count() }} {{ favorites.count() === 1 ? 'продукт' : 'продукта' }} · {{ inStockCount() }} в наличност
        </p>
      }

      @if (!favorites.count()) {
        <div class="flex flex-col items-center gap-3 py-20 text-center">
          <app-icon name="heart" [size]="48" class="text-fg-ghost" />
          <p class="text-lg font-semibold">Още нямате любими продукти</p>
          <p class="max-w-sm text-sm text-fg-muted">
            Натиснете сърцето на продукт, за да го запазите тук. Ако се изчерпа, ще остане в списъка и ще го видите отново,
            щом имаме бройка.
          </p>
          <a routerLink="/catalog" class="btn-primary mt-4">Към каталога</a>
        </div>
      } @else {
        @if (available().length) {
          <div class="mt-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" [class.opacity-60]="loading()">
            @for (listing of available(); track listing.id) {
              <app-product-card [listing]="listing" />
            }
          </div>
        }

        @if (soldOut().length) {
          <section class="mt-12">
            <h2 class="text-xl font-bold">Няма наличност в момента</h2>
            <p class="mt-1 text-sm text-fg-muted">Ще се появят горе, щом имаме бройка.</p>
            <ul class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (fav of soldOut(); track fav.key) {
                <li class="card flex items-center gap-3 p-3">
                  <span class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-well">
                    @if (fav.imageUrl) {
                      <img [src]="fav.imageUrl" alt="" loading="lazy" class="size-full object-contain p-1.5 opacity-70 mix-blend-multiply grayscale" />
                    }
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="line-clamp-2 text-sm font-semibold">{{ fav.name }}</span>
                    <span class="text-xs text-fg-muted">{{ itemNum(fav) }}</span>
                  </span>
                  <button
                    type="button"
                    class="btn-ghost size-9 shrink-0 p-0 text-fg-muted"
                    [attr.aria-label]="'Премахни от любими: ' + fav.name"
                    title="Премахни от любими"
                    (click)="favorites.remove(fav.key)"
                  >
                    <app-icon name="close" [size]="18" />
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      }
    </div>
  `,
})
export class Favorites {
  private readonly supabase = inject(Supabase);
  protected readonly favorites = inject(FavoritesStore);

  private readonly listings = signal<CatalogListing[]>([]);
  protected readonly loading = signal(false);
  private fetched = new Set<string>();

  /** In-stock listings of the favourite items, in favourites order (newest favourite first) */
  protected readonly available = computed(() => {
    const order = new Map(this.favorites.items().map((f, i) => [f.key, i]));
    return this.listings()
      .filter((l) => order.has(favoriteKey(l)))
      .sort((a, b) => order.get(favoriteKey(a))! - order.get(favoriteKey(b))! || (a.price ?? 0) - (b.price ?? 0));
  });

  protected readonly inStockCount = computed(() => new Set(this.available().map(favoriteKey)).size);

  protected readonly soldOut = computed(() => {
    const inStock = new Set(this.available().map(favoriteKey));
    return this.loading() ? [] : this.favorites.items().filter((f) => !inStock.has(f.key));
  });

  constructor() {
    effect(() => void this.load(this.favorites.items().map((f) => f.key)));
  }

  protected itemNum(fav: Favorite): string {
    return displayItemNum(fav.key.slice(fav.key.indexOf(':') + 1).split(':')[0]);
  }

  private async load(keys: string[]): Promise<void> {
    const nums = [...new Set(keys.map((k) => k.split(':')[1]))];
    // Removing a favourite only shrinks the list; no need to hit the database again
    if (nums.every((n) => this.fetched.has(n))) return;
    this.fetched = new Set(nums);
    this.loading.set(true);
    const { data } = await this.supabase.client
      .from('catalog_listings')
      .select('*')
      .in('item_num', nums)
      .eq('is_published', true)
      .gt('stock', 0);
    this.listings.set(data ?? []);
    this.loading.set(false);
  }
}
