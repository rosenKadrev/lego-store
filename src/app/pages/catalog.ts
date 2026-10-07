import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { map } from 'rxjs';
import { SHOP_NAME } from '../core/models';
import { Icon } from '../shared/icon';
import { ProductCard } from '../shared/product-card';
import { CatalogFilters, CatalogSort, CatalogStore, EMPTY_FILTERS } from '../stores/catalog.store';
import { PartFiltersStore } from '../stores/part-filters.store';
import { SIDEBAR_THEME_LIMIT, ThemesStore } from '../stores/themes.store';
import { ColorSwatch } from '../shared/color-swatch';
import { Combobox } from '../shared/combobox';

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'newest', label: 'Най-нови' },
  { value: 'price_asc', label: 'Цена: ниска към висока' },
  { value: 'price_desc', label: 'Цена: висока към ниска' },
  { value: 'name', label: 'Име' },
];

function price(value: string | null): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'до 20 €', min: null, max: 20 },
  { label: '20–50 €', min: 20, max: 50 },
  { label: '50–100 €', min: 50, max: 100 },
  { label: '100–300 €', min: 100, max: 300 },
  { label: 'над 300 €', min: 300, max: null },
];

function filtersFromParams(params: ParamMap): CatalogFilters {
  const condition = params.get('condition');
  const type = params.get('type');
  const sort = params.get('sort') as CatalogSort | null;
  const id = (name: string) => {
    const n = Number(params.get(name));
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const page = Number(params.get('page'));
  return {
    condition: condition === 'new' || condition === 'used' ? condition : null,
    type: type === 'set' || type === 'minifig' || type === 'part' || type === 'magazine' ? type : null,
    theme: id('theme'),
    color: params.has('color') && Number.isInteger(Number(params.get('color'))) ? Number(params.get('color')) : null,
    category: id('category'),
    minPrice: price(params.get('min')),
    maxPrice: price(params.get('max')),
    q: params.get('q') ?? '',
    sort: SORTS.some((s) => s.value === sort) ? sort! : 'newest',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

@Component({
  selector: 'app-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ProductCard, Icon, ColorSwatch, Combobox],
  host: { '(window:scroll)': 'onScroll()', '(window:resize)': 'onScroll()' },
  template: `
    @let f = store.filters();
    <div class="container-page pt-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ heading() }}</h1>
          <p class="mt-1 text-sm text-fg-muted">
            @if (store.loading()) { Зареждане… } @else { {{ store.total() }} продукта }
          </p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <!-- Filters: sidebar on desktop, bottom sheet on mobile -->
        <div
          class="max-lg:fixed max-lg:inset-0 max-lg:z-50"
          [class.max-lg:hidden]="!filtersOpen()"
          role="dialog"
          aria-label="Филтри"
        >
          <div class="absolute inset-0 bg-ink-900/50 lg:hidden" (click)="filtersOpen.set(false)"></div>
          <aside
            #sidebar
            [style.--sidebar-max.px]="sidebarMax()"
            class="space-y-7 max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[85vh] max-lg:overflow-y-auto max-lg:rounded-t-3xl max-lg:bg-surface max-lg:p-6 lg:sticky lg:top-[calc(var(--header-h)+0.75rem)] lg:-mr-3 lg:max-h-(--sidebar-max) lg:overflow-y-auto lg:overscroll-contain lg:pr-3 lg:pb-6 lg:[scrollbar-gutter:stable] lg:[scrollbar-width:thin]"
          >
            <div class="flex items-center justify-between lg:hidden">
              <h2 class="text-lg font-bold">Филтри</h2>
              <button type="button" class="btn-ghost size-10 p-0" aria-label="Затвори" (click)="filtersOpen.set(false)">
                <app-icon name="close" />
              </button>
            </div>

            <form (submit)="$event.preventDefault(); update({ q: searchText })" role="search">
              <label class="label" for="catalog-q">Търсене</label>
              <input id="catalog-q" name="q" type="search" class="input" placeholder="Име или номер" [(ngModel)]="searchText" />
            </form>

            <fieldset>
              <legend class="label">Състояние</legend>
              <!-- Under 375px "Употребявани" doesn't fit a third of the panel: Всички | Нови, then Употребявани -->
              <div class="grid grid-cols-3 gap-1 rounded-full bg-surface-3 p-1 text-sm max-[374px]:grid-cols-2 max-[374px]:rounded-3xl lg:grid-cols-1 lg:rounded-2xl">
                @for (opt of conditionOptions; track opt.label; let last = $last) {
                  <button
                    type="button"
                    class="rounded-full px-1 py-2 text-[13px] font-medium whitespace-nowrap transition sm:px-3 sm:text-sm lg:rounded-xl lg:text-left"
                    [class.max-[374px]:col-span-2]="last"
                    [class]="f.condition === opt.value ? 'bg-surface shadow-sm' : 'text-fg-3 hover:text-fg'"
                    (click)="update({ condition: opt.value })"
                  >
                    {{ opt.label }}
                  </button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend class="label">Вид</legend>
              <!-- Five kinds don't fit one row in the phone filter panel: 3 + 2 below lg -->
              <div class="grid grid-cols-3 gap-1 rounded-2xl bg-surface-3 p-1 text-sm lg:grid-cols-1">
                @for (opt of typeOptions; track opt.label) {
                  <button
                    type="button"
                    class="rounded-xl px-2 py-2 font-medium transition lg:text-left"
                    [class]="f.type === opt.value ? 'bg-surface shadow-sm' : 'text-fg-3 hover:text-fg'"
                    (click)="update({ type: opt.value })"
                  >
                    {{ opt.label }}
                  </button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend class="label">Цена</legend>
              <form class="flex items-center gap-2" (submit)="$event.preventDefault(); applyPrice()">
                <label class="sr-only" for="price-min">Цена от</label>
                <input
                  id="price-min"
                  class="input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  type="number"
                  min="0"
                  step="1"
                  inputmode="decimal"
                  placeholder="от €"
                  [(ngModel)]="minDraft"
                  name="min"
                  (change)="applyPrice()"
                />
                <span class="text-fg-faint">–</span>
                <label class="sr-only" for="price-max">Цена до</label>
                <input
                  id="price-max"
                  class="input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  type="number"
                  min="0"
                  step="1"
                  inputmode="decimal"
                  placeholder="до €"
                  [(ngModel)]="maxDraft"
                  name="max"
                  (change)="applyPrice()"
                />
              </form>
              <div class="mt-2 flex flex-wrap gap-1.5">
                @for (preset of pricePresets; track preset.label) {
                  <button
                    type="button"
                    class="chip py-1.5 transition"
                    [class]="f.minPrice === preset.min && f.maxPrice === preset.max ? 'bg-inverse text-on-inverse' : 'bg-surface-3 text-fg hover:bg-surface-4'"
                    (click)="setPrice(preset.min, preset.max)"
                  >
                    {{ preset.label }}
                  </button>
                }
              </div>
            </fieldset>

            @if (f.type === 'part') {
              @if (partFilters.categories().length) {
                <fieldset>
                  <legend class="label">Категория</legend>
                  <app-combobox
                    inputId="part-category"
                    placeholder="Всички категории"
                    [options]="categoryOptions()"
                    [value]="f.category"
                    (valueChange)="update({ category: $event })"
                  />
                </fieldset>
              }
              @if (partFilters.colors().length) {
                <fieldset>
                  <legend class="label">Цвят</legend>
                  <div class="flex flex-wrap gap-2">
                    @for (c of partFilters.colors(); track c.id) {
                      <button
                        type="button"
                        class="grid size-9 place-items-center rounded-full ring-2 ring-offset-2 transition"
                        [class]="f.color === c.id ? 'ring-brick-600' : 'ring-transparent hover:ring-line-strong'"
                        [title]="c.name + ' (' + c.listing_count + ')'"
                        [attr.aria-label]="c.name"
                        [attr.aria-pressed]="f.color === c.id"
                        (click)="update({ color: f.color === c.id ? null : c.id })"
                      >
                        <app-color-swatch [rgb]="c.rgb" [size]="28" [trans]="c.name.startsWith('Trans')" />
                      </button>
                    }
                  </div>
                </fieldset>
              }
            }

            @if (themes.listed().length && f.type !== 'part' && f.type !== 'minifig') {
              <fieldset>
                <legend class="label">Тема</legend>
                <ul class="space-y-0.5 text-sm">
                  <li>
                    <button
                      type="button"
                      class="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2"
                      [class.font-bold]="!f.theme"
                      (click)="update({ theme: null })"
                    >
                      Всички теми
                    </button>
                  </li>
                  @for (t of visibleThemes(); track t.theme_id) {
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-surface-2"
                        [class]="f.theme === t.theme_id ? 'bg-accent-soft font-bold text-accent-strong' : ''"
                        (click)="update({ theme: t.theme_id })"
                      >
                        {{ t.name }} <span class="text-xs text-fg-faint">{{ t.listing_count }}</span>
                      </button>
                    </li>
                  }
                </ul>
                @if (themes.listed().length > sidebarLimit) {
                  <button
                    type="button"
                    class="mt-1 flex w-full items-center gap-1 rounded-lg px-3 py-2 text-left text-sm font-semibold text-accent hover:bg-accent-soft"
                    [attr.aria-expanded]="showAllThemes()"
                    (click)="showAllThemes.set(!showAllThemes())"
                  >
                    {{ showAllThemes() ? 'Покажи по-малко' : 'Покажи всички (' + themes.listed().length + ')' }}
                    <app-icon name="chevronDown" [size]="16" class="transition" [class.rotate-180]="showAllThemes()" />
                  </button>
                }
              </fieldset>
            }

            <button type="button" class="btn-primary w-full lg:hidden" (click)="filtersOpen.set(false)">
              Покажи {{ store.total() }} продукта
            </button>
          </aside>
        </div>

        <!-- Results -->
        <div class="min-w-0">
          <!-- Sticky toolbar: sort, filters button and the active filters stay at hand while scrolling -->
          <div
            #toolbar
            class="sticky top-(--header-h) z-30 -mx-4 mb-4 border-b px-4 py-3 transition-colors sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
            [class]="stuck() ? 'border-line bg-page/95 backdrop-blur-lg' : 'border-transparent bg-page'"
          >
            <div class="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <button type="button" class="btn-outline flex-1 sm:flex-none lg:hidden" (click)="filtersOpen.set(true)">
                <app-icon name="filter" [size]="18" /> Филтри
                @if (store.hasFilters()) {
                  <span class="size-2 rounded-full bg-brick-600"></span>
                }
              </button>
              <label class="sr-only" for="sort">Подреди</label>
              <select
                id="sort"
                class="input flex-1 rounded-full sm:ml-auto sm:w-56 sm:flex-none lg:order-last"
                [ngModel]="f.sort"
                (ngModelChange)="update({ sort: $event })"
              >
                @for (s of sorts; track s.value) {
                  <option [value]="s.value">{{ s.label }}</option>
                }
              </select>
              @if (store.hasFilters()) {
                <div class="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-full sm:px-0 lg:w-auto lg:flex-1 lg:flex-wrap">
                @if (f.q) {
                  <button type="button" class="chip shrink-0 gap-1 bg-surface-3 whitespace-nowrap py-1.5 text-fg hover:bg-surface-4" (click)="update({ q: '' })">
                    „{{ f.q }}“ <app-icon name="x" [size]="14" />
                  </button>
                }
                @if (f.condition) {
                  <button type="button" class="chip shrink-0 gap-1 bg-surface-3 whitespace-nowrap py-1.5 text-fg hover:bg-surface-4" (click)="update({ condition: null })">
                    {{ f.condition === 'new' ? 'Нови' : 'Употребявани' }} <app-icon name="x" [size]="14" />
                  </button>
                }
                @if (f.type) {
                  <button type="button" class="chip shrink-0 gap-1 bg-surface-3 whitespace-nowrap py-1.5 text-fg hover:bg-surface-4" (click)="update({ type: null })">
                    {{ typeLabel[f.type] }} <app-icon name="x" [size]="14" />
                  </button>
                }
                @if (colorName()) {
                  <button type="button" class="chip shrink-0 gap-1 bg-surface-3 whitespace-nowrap py-1.5 text-fg hover:bg-surface-4" (click)="update({ color: null })">
                    {{ colorName() }} <app-icon name="x" [size]="14" />
                  </button>
                }
                @if (categoryName()) {
                  <button type="button" class="chip shrink-0 gap-1 bg-surface-3 whitespace-nowrap py-1.5 text-fg hover:bg-surface-4" (click)="update({ category: null })">
                    {{ categoryName() }} <app-icon name="x" [size]="14" />
                  </button>
                }
                @if (priceLabel()) {
                  <button type="button" class="chip shrink-0 gap-1 bg-surface-3 whitespace-nowrap py-1.5 text-fg hover:bg-surface-4" (click)="setPrice(null, null)">
                    {{ priceLabel() }} <app-icon name="x" [size]="14" />
                  </button>
                }
                @if (themeName()) {
                  <button type="button" class="chip shrink-0 gap-1 bg-surface-3 whitespace-nowrap py-1.5 text-fg hover:bg-surface-4" (click)="update({ theme: null })">
                    {{ themeName() }} <app-icon name="x" [size]="14" />
                  </button>
                }
                <button type="button" class="chip shrink-0 py-1.5 whitespace-nowrap text-accent-strong hover:underline" (click)="reset()">Изчисти всички</button>
                </div>
              } @else {
                <p class="hidden flex-1 text-sm text-fg-muted lg:block">
                  @if (!store.loading()) { {{ store.total() }} продукта }
                </p>
              }
            </div>
          </div>

          @if (store.error()) {
            <p class="rounded-2xl bg-accent-soft p-4 text-sm text-accent-ink">{{ store.error() }}</p>
          }
          <div class="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" [class.opacity-60]="store.loading()">
            @for (item of store.items(); track item.id) {
              <app-product-card [listing]="item" />
            } @empty {
              @if (store.loading()) {
                @for (i of skeleton; track i) {
                  <div class="aspect-[3/4] animate-pulse rounded-2xl bg-surface-3"></div>
                }
              } @else {
                <div class="col-span-full flex flex-col items-center gap-3 py-20 text-center">
                  <app-icon name="search" [size]="40" class="text-fg-ghost" />
                  <p class="font-semibold">Няма намерени продукти</p>
                  <p class="text-sm text-fg-muted">Опитайте с други филтри или друго търсене.</p>
                  <button type="button" class="btn-outline mt-2" (click)="reset()">Изчисти филтрите</button>
                </div>
              }
            }
          </div>

          @if (store.pageCount() > 1) {
            <nav class="mt-10 flex items-center justify-center gap-2" aria-label="Страници">
              <button type="button" class="btn-outline size-10 p-0" [disabled]="f.page <= 1" aria-label="Предишна" (click)="goToPage(f.page - 1)">
                <app-icon name="chevronLeft" />
              </button>
              @for (p of pages(); track $index) {
                @if (p === null) {
                  <span class="px-1 text-fg-faint">…</span>
                } @else {
                  <button
                    type="button"
                    class="btn size-10 p-0"
                    [class]="p === f.page ? 'bg-inverse text-on-inverse' : 'hover:bg-surface-3'"
                    [attr.aria-current]="p === f.page ? 'page' : null"
                    (click)="goToPage(p)"
                  >
                    {{ p }}
                  </button>
                }
              }
              <button
                type="button"
                class="btn-outline size-10 p-0"
                [disabled]="f.page >= store.pageCount()"
                aria-label="Следваща"
                (click)="goToPage(f.page + 1)"
              >
                <app-icon name="chevronRight" />
              </button>
            </nav>
          }
        </div>
      </div>
    </div>

    @if (showBackToTop()) {
      <button
        type="button"
        class="toast-in fixed right-4 bottom-4 z-30 grid size-12 place-items-center rounded-full bg-inverse text-on-inverse shadow-xl shadow-ink-900/30 ring-1 ring-white/15 transition hover:bg-inverse-hover sm:right-6 sm:bottom-6"
        aria-label="Към началото"
        title="Към началото"
        (click)="backToTop()"
      >
        <app-icon name="arrowUp" [size]="20" [stroke]="2.5" />
      </button>
    }
  `,
})
export class Catalog {
  protected readonly store = inject(CatalogStore);
  protected readonly themes = inject(ThemesStore);
  protected readonly partFilters = inject(PartFiltersStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);

  protected readonly sorts = SORTS;
  protected readonly skeleton = Array.from({ length: 8 }, (_, i) => i);
  protected readonly conditionOptions = [
    { value: null, label: 'Всички' },
    { value: 'new', label: 'Нови' },
    { value: 'used', label: 'Употребявани' },
  ] as const;
  protected readonly typeOptions = [
    { value: null, label: 'Всички' },
    { value: 'set', label: 'Сетове' },
    { value: 'minifig', label: 'Фигурки' },
    { value: 'part', label: 'Части' },
    { value: 'magazine', label: 'Списания' },
  ] as const;
  protected readonly typeLabel = { set: 'Сетове', minifig: 'Минифигурки', part: 'Части', magazine: 'Списания' } as const;

  protected readonly filtersOpen = signal(false);
  private readonly toolbar = viewChild<ElementRef<HTMLElement>>('toolbar');
  /** The toolbar is pinned under the header (gets a border / blur) */
  protected readonly stuck = signal(false);
  protected readonly showBackToTop = signal(false);
  private readonly sidebar = viewChild<ElementRef<HTMLElement>>('sidebar');
  /** Desktop sidebar height: from where it currently starts down to the bottom of the screen */
  protected readonly sidebarMax = signal<number | null>(null);
  private scrollFrame = 0;
  protected readonly pricePresets = PRICE_PRESETS;
  protected minDraft: number | null = null;
  protected maxDraft: number | null = null;
  protected readonly priceLabel = computed(() => {
    const { minPrice: min, maxPrice: max } = this.store.filters();
    if (min != null && max != null) return `${min}–${max} €`;
    if (min != null) return `над ${min} €`;
    if (max != null) return `до ${max} €`;
    return null;
  });
  protected readonly sidebarLimit = SIDEBAR_THEME_LIMIT;
  protected readonly showAllThemes = signal(false);
  /** First N themes, plus the selected one if it's further down the list */
  protected readonly visibleThemes = computed(() => {
    const all = this.themes.listed();
    if (this.showAllThemes() || all.length <= this.sidebarLimit) return all;
    const top = all.slice(0, this.sidebarLimit);
    const selected = all.find((t) => t.theme_id === this.store.filters().theme);
    return selected && !top.includes(selected) ? [...top, selected] : top;
  });
  protected searchText = '';

  private readonly filters = toSignal(this.route.queryParamMap.pipe(map(filtersFromParams)), {
    initialValue: EMPTY_FILTERS,
  });

  protected readonly themeName = computed(() => {
    const id = this.store.filters().theme;
    return id != null ? (this.themes.byId().get(id)?.name ?? null) : null;
  });

  protected readonly colorName = computed(() => {
    const id = this.store.filters().color;
    return id != null ? (this.partFilters.colors().find((c) => c.id === id)?.name ?? null) : null;
  });

  protected readonly categoryOptions = computed(() =>
    this.partFilters.categories().map((c) => ({ id: c.id, name: c.name, hint: String(c.listing_count) })),
  );

  protected readonly categoryName = computed(() => {
    const id = this.store.filters().category;
    return id != null ? (this.partFilters.categories().find((c) => c.id === id)?.name ?? null) : null;
  });

  protected readonly heading = computed(() => {
    const f = this.store.filters();
    if (f.type === 'part') {
      const base = this.categoryName() ?? 'Части';
      return f.condition === 'used' ? `${base} (употребявани)` : f.condition === 'new' ? `${base} (нови)` : base;
    }
    if (this.themeName()) return this.themeName()!;
    if (f.q) return `Резултати за „${f.q}“`;
    if (f.type === 'minifig') return f.condition === 'used' ? 'Употребявани минифигурки' : 'Минифигурки';
    if (f.type === 'set') return f.condition === 'used' ? 'Употребявани сетове' : f.condition === 'new' ? 'Нови сетове' : 'Сетове';
    if (f.type === 'magazine') return f.condition === 'used' ? 'Употребявани списания' : f.condition === 'new' ? 'Нови списания' : 'Списания';
    if (f.condition === 'new') return 'Нови продукти';
    if (f.condition === 'used') return 'Употребявани';
    return 'Всички продукти';
  });

  /** Page numbers with gaps: 1 … 4 5 6 … 12 */
  protected readonly pages = computed<(number | null)[]>(() => {
    const total = this.store.pageCount();
    const current = this.store.filters().page;
    const result: (number | null)[] = [];
    for (let p = 1; p <= total; p++) {
      if (p === 1 || p === total || Math.abs(p - current) <= 1) result.push(p);
      else if (result.at(-1) !== null) result.push(null);
    }
    return result;
  });

  constructor() {
    // Lists of themes / part filters may have changed since the visitor first opened the site
    void this.themes.refreshListed();
    void this.partFilters.load(true);

    effect(() => {
      const filters = this.filters();
      this.searchText = filters.q;
      this.minDraft = filters.minPrice;
      this.maxDraft = filters.maxPrice;
      untracked(() => {
        if (filters.type === 'part') void this.partFilters.load();
        void this.store.load(filters);
      });
    });
    effect(() => this.title.setTitle(`${this.heading()} | ${SHOP_NAME}`));
    afterNextRender(() => this.onScroll());
  }

  protected update(changes: Partial<CatalogFilters>): void {
    const next = { ...this.store.filters(), page: 1, ...changes };
    // Theme filters only apply to sets, colour/category only to parts
    if (next.type !== 'part') {
      next.color = null;
      next.category = null;
    }
    if (next.type === 'part' || next.type === 'minifig') next.theme = null;
    void this.router.navigate([], {
      queryParams: {
        condition: next.condition,
        type: next.type,
        theme: next.theme,
        color: next.color,
        category: next.category,
        min: next.minPrice,
        max: next.maxPrice,
        q: next.q || null,
        sort: next.sort === 'newest' ? null : next.sort,
        page: next.page > 1 ? next.page : null,
      },
    });
  }

  protected setPrice(min: number | null, max: number | null): void {
    this.update({ minPrice: min, maxPrice: max });
  }

  /** From the "от / до" inputs; swaps the values if they were entered the wrong way round. */
  protected applyPrice(): void {
    const clean = (v: number | null) => (v == null || (v as unknown) === '' || Number.isNaN(Number(v)) || Number(v) < 0 ? null : Number(v));
    let min = clean(this.minDraft);
    let max = clean(this.maxDraft);
    if (min != null && max != null && min > max) [min, max] = [max, min];
    const f = this.store.filters();
    if (min !== f.minPrice || max !== f.maxPrice) this.setPrice(min, max);
  }

  protected onScroll(): void {
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      const toolbar = this.toolbar()?.nativeElement;
      if (toolbar) {
        const top = parseFloat(getComputedStyle(toolbar).top) || 0;
        this.stuck.set(window.scrollY > 0 && toolbar.getBoundingClientRect().top <= top + 0.5);
      }
      this.showBackToTop.set(window.scrollY > window.innerHeight * 1.5);
      const sidebar = this.sidebar()?.nativeElement;
      if (sidebar) {
        // Before it gets pinned the sidebar sits lower (under the heading), so it must be shorter
        const pinnedTop = parseFloat(getComputedStyle(sidebar).top) || 0;
        const top = Math.max(sidebar.getBoundingClientRect().top, pinnedTop);
        this.sidebarMax.set(Math.max(200, Math.floor(window.innerHeight - top - 16)));
      }
    });
  }

  protected backToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected goToPage(page: number): void {
    this.update({ page });
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  protected reset(): void {
    this.searchText = '';
    void this.router.navigate([]);
  }
}
