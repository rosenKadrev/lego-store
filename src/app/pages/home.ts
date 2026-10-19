import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogListing, ItemCondition, ItemType } from '../core/models';
import { PageLoading } from '../core/page-loading';
import { Supabase } from '../core/supabase';
import { BackToTop } from '../shared/back-to-top';
import { Icon } from '../shared/icon';
import { ProductRail } from '../shared/product-rail';
import { ThemesStore } from '../stores/themes.store';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet, ProductRail, Icon, BackToTop],
  template: `
    <!-- Hero -->
    <section class="container-page pt-6 lg:pt-8">
      <div class="grid gap-4 lg:grid-cols-3">
        <a
          routerLink="/catalog"
          [queryParams]="{ condition: 'new', type: 'set' }"
          class="group relative isolate block overflow-hidden rounded-3xl bg-linear-to-br from-brick-600 via-brick-700 to-brick-900 p-5 text-white sm:grid sm:min-h-96 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:p-10 lg:col-span-2 lg:min-h-112"
        >
          <div class="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(circle_at_center,white_2px,transparent_2.5px)] [background-size:28px_28px]"></div>

          <!-- Catalog photos are JPGs on white: a white disc makes the background disappear into it.
               On phones it sits top-right next to the headline, so the products start within the first screen. -->
          @if (heroImage(); as src) {
            <div
              class="absolute top-4 right-4 grid aspect-square w-30 place-items-center rounded-full bg-white shadow-2xl shadow-brick-900/50 ring-6 ring-white/15 sm:relative sm:top-auto sm:right-auto sm:order-2 sm:mx-auto sm:w-60 sm:ring-8 lg:w-72"
            >
              <img
                [src]="src"
                alt=""
                class="pointer-events-none w-[82%] object-contain mix-blend-multiply transition duration-500 group-hover:scale-110 group-hover:-rotate-3"
              />
            </div>
          }

          <div class="relative z-10 sm:order-1">
            <span class="chip mb-3 w-fit bg-stud-400 text-ink-900 sm:mb-4">Ново в магазина</span>
            <h1 class="max-w-[9ch] text-[2rem] leading-[1.05] font-extrabold tracking-tight sm:max-w-[14ch] sm:text-5xl lg:text-6xl">Построй нещо голямо.</h1>
            <p class="mt-3 max-w-sm text-sm text-white/80 sm:text-base">Нови сетове, доставка до 5 дни и плащане при получаване.</p>
            <span class="btn mt-4 w-fit bg-white text-ink-900 group-hover:bg-stud-400 sm:mt-6">
              Разгледай новите <app-icon name="arrowRight" [size]="16" />
            </span>
          </div>
        </a>

        <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-1">
          <a
            routerLink="/catalog"
            [queryParams]="{ type: 'part' }"
            class="group relative flex flex-col justify-end overflow-hidden rounded-[1.25rem] bg-stud-400 p-4 pt-18 max-[359px]:px-3 text-ink-900 sm:min-h-52 sm:rounded-3xl sm:p-6"
          >
            @if (partPhotos().length) {
              <ng-container *ngTemplateOutlet="fan; context: { $implicit: partPhotos() }" />
            } @else {
              <app-icon name="brick" [size]="120" [stroke]="1" class="absolute -top-6 -right-6 text-ink-900/10 transition group-hover:-rotate-12" />
            }
            <h2 class="relative text-lg font-extrabold max-[359px]:text-[0.9rem] sm:max-w-[54%] sm:text-2xl">Части</h2>
            <p class="relative mt-1 hidden text-sm text-ink-900/70 sm:block sm:max-w-[54%]">Единични елементи във всякакви цветове — за подмяна, MOC или липсваща част.</p>
            <span class="relative mt-1.5 inline-flex items-center gap-1 text-[0.8rem] font-bold whitespace-nowrap max-[359px]:text-xs sm:mt-4 sm:text-sm">Виж всички <app-icon name="arrowRight" [size]="16" /></span>
          </a>
          <a
            routerLink="/catalog"
            [queryParams]="{ type: 'minifig' }"
            class="group relative flex flex-col justify-end overflow-hidden rounded-[1.25rem] bg-ink-900 p-4 pt-18 max-[359px]:px-3 text-white sm:min-h-52 sm:rounded-3xl sm:p-6 dark:ring-1 dark:ring-white/10"
          >
            @if (figPhotos().length) {
              <ng-container *ngTemplateOutlet="fan; context: { $implicit: figPhotos() }" />
            } @else {
              <app-icon name="person" [size]="120" [stroke]="1" class="absolute -top-4 -right-4 text-white/10 transition group-hover:-translate-y-1" />
            }
            <h2 class="relative text-lg font-extrabold max-[359px]:text-[0.9rem] sm:max-w-[54%] sm:text-2xl">Минифигурки</h2>
            <p class="relative mt-1 hidden text-sm text-white/70 sm:block sm:max-w-[54%]">Липсва ти някой герой? Тук е.</p>
            <span class="relative mt-1.5 inline-flex items-center gap-1 text-[0.8rem] font-bold whitespace-nowrap max-[359px]:text-xs text-stud-400 sm:mt-4 sm:text-sm">Разгледай <app-icon name="arrowRight" [size]="16" /></span>
          </a>
        </div>

        <!-- Three products from the shop, fanned out like photos on a table (top-right on phones, right on wider screens) -->
        <ng-template #fan let-photos>
          <span class="absolute top-2.5 right-2.5 h-13 w-24 sm:top-1/2 sm:right-4 sm:h-25 sm:w-41 sm:-translate-y-1/2" aria-hidden="true">
            @for (src of photos; track src; let i = $index) {
              <span
                class="absolute grid size-10.5 place-items-center rounded-[0.875rem] bg-white shadow-[0_8px_22px_rgb(0_0_0/0.2)] transition duration-300 sm:size-18.5 sm:rounded-[1.25rem]"
                [class]="fanSlot[i]"
              >
                <img [src]="src" alt="" class="size-4/5 object-contain mix-blend-multiply" />
              </span>
            }
          </span>
        </ng-template>
      </div>
    </section>

    <!-- USPs -->
    <section class="container-page mt-6">
      <!-- Phones: one row to swipe instead of a cramped 2×2 grid -->
      <ul
        class="flex snap-x gap-2 overflow-x-auto rounded-3xl bg-surface-2 p-3 text-sm [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:p-5 lg:grid-cols-4"
      >
        @for (usp of usps; track usp.title) {
          <li class="flex shrink-0 snap-start items-center gap-3 rounded-full bg-surface py-1.5 pr-4 pl-1.5 sm:rounded-none sm:bg-transparent sm:p-0">
            <span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-accent sm:size-10 sm:shadow-sm">
              <app-icon [name]="usp.icon" />
            </span>
            <span><b class="block whitespace-nowrap">{{ usp.title }}</b><span class="hidden text-xs text-fg-muted sm:inline">{{ usp.text }}</span></span>
          </li>
        }
      </ul>
    </section>

    <section class="container-page mt-10 sm:mt-14">
      <app-product-rail
        title="Ново"
        subtitle="Последно добавени нови сетове"
        [items]="newSets()"
        [loading]="loading()"
        [moreParams]="{ condition: 'new', type: 'set' }"
      />
    </section>

    @if (themes.listed().length) {
      <section class="container-page mt-12 sm:mt-16">
        <div class="mb-5 flex items-end justify-between gap-4">
          <h2 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Пазарувай по тема</h2>
          @if (themes.listed().length > 12) {
            <a routerLink="/themes" class="btn-ghost">Виж всички ({{ themes.listed().length }}) <app-icon name="arrowRight" [size]="16" /></a>
          }
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          @for (theme of themes.listed().slice(0, 12); track theme.theme_id) {
            <a
              routerLink="/catalog"
              [queryParams]="{ theme: theme.theme_id }"
              class="group flex flex-col items-center gap-2 rounded-2xl border border-line p-4 text-center transition hover:border-brick-600 hover:shadow-lg"
            >
              <span class="grid aspect-square w-full place-items-center overflow-hidden rounded-xl dark:bg-well">
                @if (themes.image(theme); as img) {
                  <img
                    [src]="img.src"
                    alt=""
                    loading="lazy"
                    class="size-full transition group-hover:scale-105"
                    [class]="img.photo ? 'object-cover' : 'object-contain mix-blend-multiply'"
                  />
                }
              </span>
              <span class="text-sm font-bold">{{ theme.name }}</span>
              <span class="text-xs text-fg-muted">{{ theme.listing_count }} продукта</span>
            </a>
          }
        </div>
      </section>
    }

    <section class="container-page mt-10 sm:mt-14">
      <app-product-rail
        title="Списания"
        subtitle="LEGO списания с минифигурка или модел"
        [items]="magazines()"
        [loading]="loading()"
        [moreParams]="{ type: 'magazine' }"
      />
    </section>

    <section class="container-page mt-10 sm:mt-14">
      <app-product-rail
        title="Части"
        subtitle="Нови и употребявани части на брой"
        [items]="parts()"
        [loading]="loading()"
        [moreParams]="{ type: 'part' }"
      />
    </section>

    <section class="container-page mt-10 sm:mt-14">
      <app-product-rail
        title="Минифигурки"
        [items]="minifigs()"
        [loading]="loading()"
        [moreParams]="{ type: 'minifig' }"
      />
    </section>

    <app-back-to-top />
  `,
})
export class Home implements OnInit {
  private readonly supabase = inject(Supabase);
  private readonly pageLoading = inject(PageLoading);
  protected readonly themes = inject(ThemesStore);

  protected readonly loading = signal(true);
  protected readonly newSets = signal<CatalogListing[]>([]);
  protected readonly magazines = signal<CatalogListing[]>([]);
  protected readonly minifigs = signal<CatalogListing[]>([]);
  protected readonly parts = signal<CatalogListing[]>([]);
  protected readonly heroImage = signal<string | null>(null);
  /** Up to three product photos for the Части / Минифигурки cards (catalog photos: white background) */
  protected readonly partPhotos = computed(() => this.photos(this.parts()));
  protected readonly figPhotos = computed(() => this.photos(this.minifigs()));
  /** Position and tilt of each photo in the fan */
  protected readonly fanSlot = [
    'left-0 top-1.5 -rotate-10 sm:top-4 group-hover:-rotate-14',
    'left-6.5 top-0 rotate-6 sm:left-11 group-hover:-translate-y-1',
    'left-13 top-2 -rotate-3 sm:left-22 sm:top-5.5 group-hover:rotate-2',
  ];

  protected readonly usps = [
    { icon: 'cash', title: 'Наложен платеж', text: 'Плащаш при получаване' },
    { icon: 'eye', title: 'Преглед преди плащане', text: 'С Еконт и Спиди' },
    { icon: 'truck', title: 'Бърза доставка', text: 'До офис, адрес или лично' },
    { icon: 'refresh', title: '14 дни за връщане', text: 'Без излишни въпроси' },
  ] as const;

  async ngOnInit(): Promise<void> {
    void this.themes.refreshListed();
    const [newSets, magazines, minifigs, parts] = await this.pageLoading.track(
      Promise.all([this.fetch('new', 'set'), this.fetch(null, 'magazine'), this.fetch(null, 'minifig'), this.fetch(null, 'part')]),
    );
    this.parts.set(parts);
    this.newSets.set(newSets);
    this.magazines.set(magazines);
    this.minifigs.set(minifigs);
    const featured = [...newSets].sort((a, b) => (b.num_parts ?? 0) - (a.num_parts ?? 0))[0];
    this.heroImage.set(featured?.catalog_img_url ?? null);
    this.loading.set(false);
  }

  /** Catalog photos first (white background, blends into the white tiles), then the listings' own */
  private photos(items: CatalogListing[]): string[] {
    const catalog = items.map((l) => l.catalog_img_url);
    const own = items.map((l) => this.supabase.coverUrl(l));
    return [...new Set([...catalog, ...own].filter((src): src is string => !!src))].slice(0, 3);
  }

  private async fetch(condition: ItemCondition | null, type: ItemType): Promise<CatalogListing[]> {
    let query = this.supabase.client
      .from('catalog_listings')
      .select('*')
      .eq('is_published', true)
      .eq('item_type', type)
      .gt('stock', 0);
    if (condition) query = query.eq('condition', condition);
    const { data } = await query.order('created_at', { ascending: false }).limit(12);
    return data ?? [];
  }
}
