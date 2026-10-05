import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BOX_DAMAGED_LABEL, CatalogListing, CONDITION_LABEL, displayItemNum, slugify } from '../core/models';
import { Supabase } from '../core/supabase';
import { CartStore } from '../stores/cart.store';
import { ColorSwatch } from './color-swatch';
import { Icon } from './icon';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, Icon, ColorSwatch],
  host: { class: 'block' },
  template: `
    @let l = listing();
    <article
      class="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-zinc-200/70"
    >
      <a [routerLink]="link()" class="relative block aspect-square bg-zinc-50">
        @if (image(); as src) {
          <img
            [src]="src"
            [alt]="l.name"
            loading="lazy"
            class="absolute inset-0 h-full w-full object-contain p-5 mix-blend-multiply transition duration-300 group-hover:scale-105"
          />
        } @else {
          <div class="absolute inset-0 grid place-items-center text-zinc-300"><app-icon name="image" [size]="48" /></div>
        }
        <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span class="chip" [class]="l.condition === 'new' ? 'bg-emerald-600 text-white' : 'bg-stud-400 text-ink-900'">
            {{ conditionLabel() }}
          </span>
          @if (l.box_damaged) {
            <span class="chip bg-amber-100 text-amber-900 ring-1 ring-amber-300">{{ boxDamagedLabel }}</span>
          }
          @if (discount(); as d) {
            <span class="chip bg-brick-600 text-white">-{{ d }}%</span>
          }
        </div>
      </a>

      <div class="flex flex-1 flex-col gap-1 p-4">
        <p class="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          {{ l.theme_name ?? l.part_category ?? (l.item_type === 'minifig' ? 'Минифигурка' : 'LEGO') }} · {{ itemNum() }}
        </p>
        <h3 class="line-clamp-2 font-sans text-sm leading-snug font-semibold text-ink-900">
          <a [routerLink]="link()" class="after:absolute after:inset-0 after:content-['']">{{ l.name }}</a>
        </h3>
        @if (l.item_type === 'part') {
          <p class="flex items-center gap-1.5 text-xs text-zinc-600">
            <app-color-swatch [rgb]="l.color_rgb" [trans]="!!l.color_name?.startsWith('Trans')" [size]="12" />
            {{ l.color_name }} · {{ l.stock }} бр.
          </p>
        }
        @if (l.condition === 'used' && l.item_type === 'set') {
          <p class="text-xs text-zinc-500">
            {{ l.has_box ? 'С кутия' : 'Без кутия' }} · {{ l.is_complete === false ? 'Непълен' : 'Пълен' }}
          </p>
        }
        <div class="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            @if (l.compare_at_price) {
              <p class="text-xs text-zinc-400 line-through">{{ l.compare_at_price | currency }}</p>
            }
            <p class="font-display text-lg font-bold" [class.text-brick-600]="l.compare_at_price">
              {{ l.price | currency }}
              @if (l.item_type === 'part') {
                <span class="font-sans text-xs font-medium text-zinc-500">/ бр.</span>
              }
            </p>
          </div>
          <button
            type="button"
            class="relative z-10 grid size-10 place-items-center rounded-full bg-ink-900 text-white transition hover:bg-brick-600 disabled:bg-zinc-200 disabled:text-zinc-400"
            [disabled]="soldOut()"
            [attr.aria-label]="'Добави ' + l.name + ' в количката'"
            (click)="addToCart()"
          >
            <app-icon [name]="inCart() ? 'check' : 'plus'" />
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCard {
  private readonly supabase = inject(Supabase);
  private readonly cart = inject(CartStore);

  readonly listing = input.required<CatalogListing>();
  protected readonly boxDamagedLabel = BOX_DAMAGED_LABEL;

  protected readonly image = computed(() => this.supabase.coverUrl(this.listing()));
  protected readonly itemNum = computed(() => displayItemNum(this.listing().item_num));
  protected readonly conditionLabel = computed(() => CONDITION_LABEL[this.listing().condition ?? 'new']);
  protected readonly link = computed(() => ['/p', `${this.listing().id}-${slugify(this.listing().name ?? '')}`]);
  protected readonly discount = computed(() => {
    const { price, compare_at_price } = this.listing();
    return price != null && compare_at_price ? Math.round((1 - price / compare_at_price) * 100) : null;
  });
  protected readonly inCart = computed(() => this.cart.quantityOf(this.listing().id ?? -1) > 0);
  protected readonly soldOut = computed(
    () => this.cart.quantityOf(this.listing().id ?? -1) >= (this.listing().stock ?? 0),
  );

  protected addToCart(): void {
    this.cart.add(this.listing(), this.image());
  }
}
