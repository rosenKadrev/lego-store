import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogListing, ItemCondition, ItemType } from '../core/models';
import { Supabase } from '../core/supabase';
import { Icon } from '../shared/icon';
import { ProductRail } from '../shared/product-rail';
import { ThemesStore } from '../stores/themes.store';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductRail, Icon],
  template: `
    <!-- Hero -->
    <section class="container-page pt-6 lg:pt-8">
      <div class="grid gap-4 lg:grid-cols-3">
        <a
          routerLink="/catalog"
          [queryParams]="{ condition: 'new', type: 'set' }"
          class="group relative isolate grid min-h-80 items-center gap-6 overflow-hidden rounded-3xl bg-linear-to-br from-brick-600 via-brick-700 to-brick-900 p-6 text-white sm:min-h-96 sm:grid-cols-[1fr_auto] sm:p-10 lg:col-span-2 lg:min-h-112"
        >
          <div class="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(circle_at_center,white_2px,transparent_2.5px)] [background-size:28px_28px]"></div>

          <!-- Catalog photos are JPGs on white: a white disc makes the background disappear into it -->
          @if (heroImage(); as src) {
            <div
              class="relative mx-auto grid aspect-square w-52 place-items-center rounded-full bg-white shadow-2xl shadow-brick-900/50 ring-8 ring-white/15 sm:order-2 sm:w-60 lg:w-72"
            >
              <img
                [src]="src"
                alt=""
                class="pointer-events-none w-[82%] object-contain mix-blend-multiply transition duration-500 group-hover:scale-110 group-hover:-rotate-3"
              />
            </div>
          }

          <div class="relative z-10 sm:order-1">
            <span class="chip mb-4 w-fit bg-stud-400 text-ink-900">Ново в магазина</span>
            <h1 class="max-w-[14ch] text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">Строй нещо голямо.</h1>
            <p class="mt-3 max-w-sm text-white/80">Нови сетове, доставка до 5 дни и плащане при получаване.</p>
            <span class="btn mt-6 w-fit bg-white text-ink-900 group-hover:bg-stud-400">
              Разгледай новите <app-icon name="arrowRight" [size]="16" />
            </span>
          </div>
        </a>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <a
            routerLink="/catalog"
            [queryParams]="{ condition: 'used' }"
            class="group relative flex min-h-52 flex-col justify-end overflow-hidden rounded-3xl bg-stud-400 p-6 text-ink-900"
          >
            <app-icon name="refresh" [size]="120" [stroke]="1" class="absolute -top-6 -right-6 text-ink-900/10 transition group-hover:rotate-45" />
            <h2 class="text-2xl font-extrabold">Употребявани</h2>
            <p class="mt-1 text-sm text-ink-900/70">Проверени бройки с описано състояние и реални снимки при интерес.</p>
            <span class="mt-4 inline-flex items-center gap-1 text-sm font-bold">Виж всички <app-icon name="arrowRight" [size]="16" /></span>
          </a>
          <a
            routerLink="/catalog"
            [queryParams]="{ type: 'minifig' }"
            class="group relative flex min-h-52 flex-col justify-end overflow-hidden rounded-3xl bg-ink-900 p-6 text-white"
          >
            <app-icon name="person" [size]="120" [stroke]="1" class="absolute -top-4 -right-4 text-white/10 transition group-hover:-translate-y-1" />
            <h2 class="text-2xl font-extrabold">Минифигурки</h2>
            <p class="mt-1 text-sm text-white/70">Липсва ти някой герой? Тук е.</p>
            <span class="mt-4 inline-flex items-center gap-1 text-sm font-bold text-stud-400">Разгледай <app-icon name="arrowRight" [size]="16" /></span>
          </a>
        </div>
      </div>
    </section>

    <!-- USPs -->
    <section class="container-page mt-6">
      <ul class="grid grid-cols-2 gap-3 rounded-3xl bg-zinc-50 p-4 text-sm sm:p-5 lg:grid-cols-4">
        @for (usp of usps; track usp.title) {
          <li class="flex items-center gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brick-600 shadow-sm">
              <app-icon [name]="usp.icon" />
            </span>
            <span><b class="block">{{ usp.title }}</b><span class="text-xs text-zinc-500">{{ usp.text }}</span></span>
          </li>
        }
      </ul>
    </section>

    <section class="container-page mt-14">
      <app-product-rail
        title="Ново"
        subtitle="Последно добавени нови сетове"
        [items]="newSets()"
        [loading]="loading()"
        [moreParams]="{ condition: 'new', type: 'set' }"
      />
    </section>

    @if (themes.listed().length) {
      <section class="container-page mt-16">
        <h2 class="mb-5 text-2xl font-extrabold tracking-tight sm:text-3xl">Пазарувай по тема</h2>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          @for (theme of themes.listed().slice(0, 12); track theme.theme_id) {
            <a
              routerLink="/catalog"
              [queryParams]="{ theme: theme.theme_id }"
              class="group flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 p-4 text-center transition hover:border-brick-600 hover:shadow-lg"
            >
              <span class="grid aspect-square w-full place-items-center overflow-hidden">
                @if (theme.sample_img_url) {
                  <img [src]="theme.sample_img_url" alt="" loading="lazy" class="size-full object-contain mix-blend-multiply transition group-hover:scale-105" />
                }
              </span>
              <span class="text-sm font-bold">{{ theme.name }}</span>
              <span class="text-xs text-zinc-500">{{ theme.listing_count }} продукта</span>
            </a>
          }
        </div>
      </section>
    }

    <section class="mt-16 bg-zinc-50 py-14">
      <div class="container-page">
        <app-product-rail
          title="Употребявани"
          subtitle="Всяка бройка е уникална — с описано състояние"
          [items]="usedSets()"
          [loading]="loading()"
          [moreParams]="{ condition: 'used' }"
        />
      </div>
    </section>

    <section class="container-page mt-14">
      <app-product-rail
        title="Части"
        subtitle="Нови и употребявани части на брой"
        [items]="parts()"
        [loading]="loading()"
        [moreParams]="{ type: 'part' }"
      />
    </section>

    <section class="container-page mt-14">
      <app-product-rail
        title="Минифигурки"
        [items]="minifigs()"
        [loading]="loading()"
        [moreParams]="{ type: 'minifig' }"
      />
    </section>
  `,
})
export class Home implements OnInit {
  private readonly supabase = inject(Supabase);
  protected readonly themes = inject(ThemesStore);

  protected readonly loading = signal(true);
  protected readonly newSets = signal<CatalogListing[]>([]);
  protected readonly usedSets = signal<CatalogListing[]>([]);
  protected readonly minifigs = signal<CatalogListing[]>([]);
  protected readonly parts = signal<CatalogListing[]>([]);
  protected readonly heroImage = signal<string | null>(null);

  protected readonly usps = [
    { icon: 'cash', title: 'Наложен платеж', text: 'Плащаш при получаване' },
    { icon: 'eye', title: 'Преглед преди плащане', text: 'С Еконт и Спиди' },
    { icon: 'truck', title: 'Бърза доставка', text: 'До офис или адрес' },
    { icon: 'refresh', title: '14 дни за връщане', text: 'Без излишни въпроси' },
  ] as const;

  async ngOnInit(): Promise<void> {
    const [newSets, usedSets, minifigs, parts] = await Promise.all([
      this.fetch('new', 'set'),
      this.fetch('used', 'set'),
      this.fetch(null, 'minifig'),
      this.fetch(null, 'part'),
    ]);
    this.parts.set(parts);
    this.newSets.set(newSets);
    this.usedSets.set(usedSets);
    this.minifigs.set(minifigs);
    const featured = [...newSets].sort((a, b) => (b.num_parts ?? 0) - (a.num_parts ?? 0))[0];
    this.heroImage.set(featured?.catalog_img_url ?? null);
    this.loading.set(false);
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
