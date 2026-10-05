import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { map } from 'rxjs';
import { SHOP_NAME } from '../core/models';
import { Icon } from '../shared/icon';
import { ProductCard } from '../shared/product-card';
import { CatalogFilters, CatalogSort, CatalogStore, EMPTY_FILTERS } from '../stores/catalog.store';
import { ThemesStore } from '../stores/themes.store';

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'newest', label: 'Най-нови' },
  { value: 'price_asc', label: 'Цена: ниска към висока' },
  { value: 'price_desc', label: 'Цена: висока към ниска' },
  { value: 'name', label: 'Име' },
];

function filtersFromParams(params: ParamMap): CatalogFilters {
  const condition = params.get('condition');
  const type = params.get('type');
  const sort = params.get('sort') as CatalogSort | null;
  const theme = Number(params.get('theme'));
  const page = Number(params.get('page'));
  return {
    condition: condition === 'new' || condition === 'used' ? condition : null,
    type: type === 'set' || type === 'minifig' ? type : null,
    theme: Number.isInteger(theme) && theme > 0 ? theme : null,
    q: params.get('q') ?? '',
    sort: SORTS.some((s) => s.value === sort) ? sort! : 'newest',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

@Component({
  selector: 'app-catalog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ProductCard, Icon],
  template: `
    @let f = store.filters();
    <div class="container-page pt-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ heading() }}</h1>
          <p class="mt-1 text-sm text-zinc-500">
            @if (store.loading()) { Зареждане… } @else { {{ store.total() }} продукта }
          </p>
        </div>
        <div class="flex w-full items-center gap-2 sm:w-auto">
          <button type="button" class="btn-outline flex-1 lg:hidden" (click)="filtersOpen.set(true)">
            <app-icon name="filter" [size]="18" /> Филтри
            @if (store.hasFilters()) {
              <span class="size-2 rounded-full bg-brick-600"></span>
            }
          </button>
          <label class="sr-only" for="sort">Подреди</label>
          <select id="sort" class="input flex-1 rounded-full sm:w-56" [ngModel]="f.sort" (ngModelChange)="update({ sort: $event })">
            @for (s of sorts; track s.value) {
              <option [value]="s.value">{{ s.label }}</option>
            }
          </select>
        </div>
      </div>

      @if (store.hasFilters()) {
        <div class="mt-4 flex flex-wrap gap-2">
          @if (f.q) {
            <button type="button" class="chip gap-1 bg-zinc-100 py-1.5 text-ink-900 hover:bg-zinc-200" (click)="update({ q: '' })">
              „{{ f.q }}“ <app-icon name="x" [size]="14" />
            </button>
          }
          @if (f.condition) {
            <button type="button" class="chip gap-1 bg-zinc-100 py-1.5 text-ink-900 hover:bg-zinc-200" (click)="update({ condition: null })">
              {{ f.condition === 'new' ? 'Нови' : 'Употребявани' }} <app-icon name="x" [size]="14" />
            </button>
          }
          @if (f.type) {
            <button type="button" class="chip gap-1 bg-zinc-100 py-1.5 text-ink-900 hover:bg-zinc-200" (click)="update({ type: null })">
              {{ f.type === 'set' ? 'Сетове' : 'Минифигурки' }} <app-icon name="x" [size]="14" />
            </button>
          }
          @if (themeName()) {
            <button type="button" class="chip gap-1 bg-zinc-100 py-1.5 text-ink-900 hover:bg-zinc-200" (click)="update({ theme: null })">
              {{ themeName() }} <app-icon name="x" [size]="14" />
            </button>
          }
          <button type="button" class="chip py-1.5 text-brick-700 hover:underline" (click)="reset()">Изчисти всички</button>
        </div>
      }

      <div class="mt-6 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <!-- Filters: sidebar on desktop, bottom sheet on mobile -->
        <div
          class="max-lg:fixed max-lg:inset-0 max-lg:z-50"
          [class.max-lg:hidden]="!filtersOpen()"
          role="dialog"
          aria-label="Филтри"
        >
          <div class="absolute inset-0 bg-ink-900/50 lg:hidden" (click)="filtersOpen.set(false)"></div>
          <aside
            class="space-y-7 max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[85vh] max-lg:overflow-y-auto max-lg:rounded-t-3xl max-lg:bg-white max-lg:p-6 lg:sticky lg:top-32"
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
              <div class="grid grid-cols-3 gap-1 rounded-full bg-zinc-100 p-1 text-sm lg:grid-cols-1 lg:rounded-2xl">
                @for (opt of conditionOptions; track opt.label) {
                  <button
                    type="button"
                    class="rounded-full px-3 py-2 font-medium transition lg:rounded-xl lg:text-left"
                    [class]="f.condition === opt.value ? 'bg-white shadow-sm' : 'text-zinc-600 hover:text-ink-900'"
                    (click)="update({ condition: opt.value })"
                  >
                    {{ opt.label }}
                  </button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend class="label">Вид</legend>
              <div class="grid grid-cols-3 gap-1 rounded-full bg-zinc-100 p-1 text-sm lg:grid-cols-1 lg:rounded-2xl">
                @for (opt of typeOptions; track opt.label) {
                  <button
                    type="button"
                    class="rounded-full px-3 py-2 font-medium transition lg:rounded-xl lg:text-left"
                    [class]="f.type === opt.value ? 'bg-white shadow-sm' : 'text-zinc-600 hover:text-ink-900'"
                    (click)="update({ type: opt.value })"
                  >
                    {{ opt.label }}
                  </button>
                }
              </div>
            </fieldset>

            @if (themes.listed().length) {
              <fieldset>
                <legend class="label">Тема</legend>
                <ul class="space-y-0.5 text-sm">
                  <li>
                    <button
                      type="button"
                      class="w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-50"
                      [class.font-bold]="!f.theme"
                      (click)="update({ theme: null })"
                    >
                      Всички теми
                    </button>
                  </li>
                  @for (t of themes.listed(); track t.theme_id) {
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-zinc-50"
                        [class]="f.theme === t.theme_id ? 'bg-brick-50 font-bold text-brick-700' : ''"
                        (click)="update({ theme: t.theme_id })"
                      >
                        {{ t.name }} <span class="text-xs text-zinc-400">{{ t.listing_count }}</span>
                      </button>
                    </li>
                  }
                </ul>
              </fieldset>
            }

            <button type="button" class="btn-primary w-full lg:hidden" (click)="filtersOpen.set(false)">
              Покажи {{ store.total() }} продукта
            </button>
          </aside>
        </div>

        <!-- Results -->
        <div>
          @if (store.error()) {
            <p class="rounded-2xl bg-brick-50 p-4 text-sm text-brick-800">{{ store.error() }}</p>
          }
          <div class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" [class.opacity-60]="store.loading()">
            @for (item of store.items(); track item.id) {
              <app-product-card [listing]="item" />
            } @empty {
              @if (store.loading()) {
                @for (i of skeleton; track i) {
                  <div class="aspect-[3/4] animate-pulse rounded-2xl bg-zinc-100"></div>
                }
              } @else {
                <div class="col-span-full flex flex-col items-center gap-3 py-20 text-center">
                  <app-icon name="search" [size]="40" class="text-zinc-300" />
                  <p class="font-semibold">Няма намерени продукти</p>
                  <p class="text-sm text-zinc-500">Опитайте с други филтри или друго търсене.</p>
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
                  <span class="px-1 text-zinc-400">…</span>
                } @else {
                  <button
                    type="button"
                    class="btn size-10 p-0"
                    [class]="p === f.page ? 'bg-ink-900 text-white' : 'hover:bg-zinc-100'"
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
  `,
})
export class Catalog {
  protected readonly store = inject(CatalogStore);
  protected readonly themes = inject(ThemesStore);
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
  ] as const;

  protected readonly filtersOpen = signal(false);
  protected searchText = '';

  private readonly filters = toSignal(this.route.queryParamMap.pipe(map(filtersFromParams)), {
    initialValue: EMPTY_FILTERS,
  });

  protected readonly themeName = computed(() => {
    const id = this.store.filters().theme;
    return id != null ? (this.themes.byId().get(id)?.name ?? null) : null;
  });

  protected readonly heading = computed(() => {
    const f = this.store.filters();
    if (this.themeName()) return this.themeName()!;
    if (f.q) return `Резултати за „${f.q}“`;
    if (f.type === 'minifig') return f.condition === 'used' ? 'Употребявани минифигурки' : 'Минифигурки';
    if (f.type === 'set') return f.condition === 'used' ? 'Употребявани сетове' : f.condition === 'new' ? 'Нови сетове' : 'Сетове';
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
    effect(() => {
      const filters = this.filters();
      this.searchText = filters.q;
      untracked(() => void this.store.load(filters));
    });
    effect(() => this.title.setTitle(`${this.heading()} | ${SHOP_NAME}`));
  }

  protected update(changes: Partial<CatalogFilters>): void {
    const next = { ...this.store.filters(), page: 1, ...changes };
    void this.router.navigate([], {
      queryParams: {
        condition: next.condition,
        type: next.type,
        theme: next.theme,
        q: next.q || null,
        sort: next.sort === 'newest' ? null : next.sort,
        page: next.page > 1 ? next.page : null,
      },
    });
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
