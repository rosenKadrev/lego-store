import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { Analytics } from '../core/analytics';
import { Seo } from '../core/seo';
import { BOX_DAMAGED_LABEL, CONDITION_LABEL, displayItemNum, isCustomFigNum, SHOP_NAME, slugify } from '../core/models';
import { ColorSwatch } from '../shared/color-swatch';
import { FavoriteButton } from '../shared/favorite-button';
import { Icon } from '../shared/icon';
import { ProductRail } from '../shared/product-rail';
import { QuantityStepper } from '../shared/quantity-stepper';
import { CartStore } from '../stores/cart.store';
import { LiveStockStore } from '../stores/live-stock.store';
import { ProductStore } from '../stores/product.store';
import { ThemesStore } from '../stores/themes.store';

@Component({
  selector: 'app-product',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, Icon, QuantityStepper, ColorSwatch, FavoriteButton, ProductRail],
  providers: [ProductStore],
  template: `
    <div class="container-page pt-6">
      @if (store.loading()) {
        <div class="grid gap-8 lg:grid-cols-2">
          <div class="aspect-square animate-pulse rounded-3xl bg-surface-3"></div>
          <div class="space-y-4">
            <div class="h-6 w-1/3 animate-pulse rounded bg-surface-3"></div>
            <div class="h-10 w-3/4 animate-pulse rounded bg-surface-3"></div>
            <div class="h-24 animate-pulse rounded bg-surface-3"></div>
          </div>
        </div>
      } @else if (store.notFound()) {
        <div class="flex flex-col items-center gap-4 py-24 text-center">
          <h1 class="text-3xl font-extrabold">Продуктът не е намерен</h1>
          <p class="text-fg-muted">Може би вече е продаден или връзката е грешна.</p>
          <a routerLink="/catalog" class="btn-primary">Към каталога</a>
        </div>
      } @else if (store.listing(); as l) {
        <nav class="mb-5 flex flex-wrap items-center gap-1 text-sm text-fg-muted" aria-label="Навигация">
          <a routerLink="/" class="hover:text-fg">Начало</a>
          @if (l.item_type === 'magazine') {
            <app-icon name="chevronRight" [size]="14" />
            <a routerLink="/catalog" [queryParams]="{ type: 'magazine' }" class="hover:text-fg">Списания</a>
          }
          @for (t of themePath(); track t.id) {
            <app-icon name="chevronRight" [size]="14" />
            <a
              routerLink="/catalog"
              [queryParams]="l.item_type === 'magazine' ? { type: 'magazine', theme: t.id } : { theme: t.id }"
              class="hover:text-fg"
              >{{ t.name }}</a
            >
          }
          @if (l.item_type === 'minifig') {
            <app-icon name="chevronRight" [size]="14" />
            <a routerLink="/catalog" [queryParams]="{ type: 'minifig' }" class="hover:text-fg">Минифигурки</a>
          }
          @if (l.item_type === 'part') {
            <app-icon name="chevronRight" [size]="14" />
            <a routerLink="/catalog" [queryParams]="{ type: 'part' }" class="hover:text-fg">Части</a>
            @if (l.part_category) {
              <app-icon name="chevronRight" [size]="14" />
              <a routerLink="/catalog" [queryParams]="{ type: 'part', category: l.part_cat_id }" class="hover:text-fg">{{ l.part_category }}</a>
            }
          }
        </nav>

        <div class="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <!-- Gallery -->
          <div class="lg:sticky lg:top-32 lg:self-start">
            <div class="relative aspect-square overflow-hidden rounded-3xl bg-well">
              @if (!activeImageFailed() && activeImage(); as src) {
                <img
                  [src]="src"
                  [alt]="l.name"
                  class="absolute inset-0 size-full object-contain p-6 mix-blend-multiply sm:p-10"
                  (error)="activeImageFailed.set(true)"
                />
              } @else {
                <div class="absolute inset-0 grid place-items-center text-fg-ghost"><app-icon name="image" [size]="64" /></div>
              }
              <div class="absolute top-4 left-4 flex flex-wrap gap-1.5">
                <span class="chip text-sm" [class]="l.condition === 'new' ? 'bg-emerald-600 text-white' : 'bg-stud-400 text-ink-900'">{{
                  conditionLabel[l.condition!]
                }}</span>
                @if (l.box_damaged) {
                  <span class="chip bg-amber-100 text-sm text-amber-900 ring-1 ring-amber-300">{{ boxDamagedLabel }}</span>
                }
              </div>
            </div>
            @if (store.gallery().length > 1) {
              <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
                @for (src of store.gallery(); track src; let i = $index) {
                  <button
                    type="button"
                    class="size-20 shrink-0 overflow-hidden rounded-xl border-2 bg-well transition"
                    [class]="i === activeIndex() ? 'border-brick-600' : 'border-transparent hover:border-line-strong'"
                    [attr.aria-label]="'Снимка ' + (i + 1)"
                    (click)="activeIndex.set(i)"
                  >
                    <img [src]="src" alt="" class="size-full object-contain p-1 mix-blend-multiply" />
                  </button>
                }
              </div>
            }
          </div>

          <!-- Details -->
          <div>
            <p class="text-sm font-semibold tracking-wide text-accent uppercase">
              @if (isCustom()) { {{ itemNum() }} } @else { {{ l.theme_name ?? l.part_category ?? (l.item_type === 'magazine' ? 'LEGO' : 'Минифигурка') }} · {{ itemNum() }} }
            </p>
            <h1 class="mt-2 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{{ l.name }}</h1>
            @if (l.name_en) {
              <p class="mt-1 text-sm text-fg-muted italic" lang="en">{{ l.name_en }}</p>
            }
            @if (l.item_type === 'part') {
              <p class="mt-3 inline-flex items-center gap-2 rounded-full bg-surface-3 py-1.5 pr-4 pl-2 text-sm font-medium">
                <app-color-swatch [rgb]="l.color_rgb" [trans]="!!l.color_name?.startsWith('Trans')" [size]="20" />
                {{ l.color_name }}
              </p>
            }

            <div class="mt-5 flex items-end gap-3">
              <p class="font-display text-4xl font-extrabold" [class.text-accent]="l.compare_at_price">
                {{ l.price | currency }}
                @if (l.item_type === 'part') {
                  <span class="font-sans text-base font-medium text-fg-muted">/ бр.</span>
                }
              </p>
              @if (l.compare_at_price) {
                <p class="pb-1 text-lg text-fg-faint line-through">{{ l.compare_at_price | currency }}</p>
              }
            </div>
            <p class="mt-2 flex items-center gap-1.5 text-sm" [class]="available() > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-accent-strong'">
              <span class="size-2 rounded-full" [class]="available() > 0 ? 'bg-emerald-500' : 'bg-brick-600'"></span>
              @if (stock() === 0) {
                Изчерпан
              } @else if (l.item_type === 'part') {
                {{ stock() === 1 ? 'Налична' : 'Налични' }} {{ stock() }} бр.
              } @else if (l.condition === 'used') {
                Единствена бройка
              } @else if (stock() <= 3) {
                {{ stock() === 1 ? 'Остава' : 'Остават' }} само {{ stock() }} бр.
              } @else {
                В наличност
              }
            </p>

            <div #buyRow class="mt-6 flex flex-wrap items-center gap-3">
              @if (stock() > 1) {
                <app-quantity-stepper [large]="true" [value]="quantity()" [min]="1" [max]="available()" (valueChange)="quantity.set($event)" />
              }
              <button type="button" class="btn-primary h-11 flex-1 text-base max-[350px]:text-sm sm:flex-none sm:px-10" [class.whitespace-nowrap]="available() > 0" [disabled]="available() === 0" (click)="addToCart()">
                <app-icon name="cart" [size]="20" class="max-[350px]:hidden" />
                {{ available() === 0 && inCart() ? 'Всички бройки са в количката' : 'Добави в количката' }}
              </button>
              <app-favorite-button [listing]="l" [large]="true" />
            </div>

            <ul class="mt-6 grid gap-2 rounded-2xl bg-surface-2 p-4 text-sm sm:grid-cols-2">
              <li class="flex items-center gap-2"><app-icon name="cash" [size]="18" class="text-accent" /> Плащане с наложен платеж</li>
              <li class="flex items-center gap-2"><app-icon name="eye" [size]="18" class="text-accent" /> Преглед преди плащане</li>
              <li class="flex items-center gap-2"><app-icon name="truck" [size]="18" class="text-accent" /> Еконт или Спиди, 2–5 дни</li>
              <li class="flex items-center gap-2"><app-icon name="refresh" [size]="18" class="text-accent" /> 14 дни право на връщане</li>
            </ul>

            @if (l.box_damaged) {
              <section class="mt-6 rounded-2xl border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-400/10 p-4 text-sm">
                <h2 class="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200"><app-icon name="box" [size]="18" /> {{ boxDamagedLabel }}</h2>
                <p class="mt-1 text-amber-900/80 dark:text-amber-200/80">Сетът е нов и запечатан. Кутията има козметични наранявания — съдържанието не е засегнато.</p>
                @if (l.condition_notes) {
                  <p class="mt-2 font-medium text-amber-950 dark:text-amber-200">{{ l.condition_notes }}</p>
                }
              </section>
            }

            @if (l.condition === 'used' && (l.item_type === 'set' || l.condition_notes)) {
              <section class="mt-8">
                <h2 class="text-lg font-bold">Състояние</h2>
                <dl class="mt-3 grid grid-cols-1 gap-2 text-sm min-[360px]:grid-cols-2" [class.hidden]="l.item_type !== 'set'">
                  @for (row of usedDetails(); track row.label) {
                    <div class="flex items-center gap-2 rounded-xl border border-line p-3">
                      <app-icon [name]="row.ok ? 'check' : 'x'" [size]="18" [class]="row.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-accent'" />
                      <dt class="sr-only">{{ row.label }}</dt>
                      <dd>{{ row.text }}</dd>
                    </div>
                  }
                </dl>
                @if (l.condition_notes) {
                  <p class="mt-3 rounded-xl bg-stud-300/30 dark:bg-stud-400/15 p-3 text-sm">{{ l.condition_notes }}</p>
                }
              </section>
            }

            @if (l.description) {
              <section class="mt-8">
                <h2 class="text-lg font-bold">Описание</h2>
                <p class="mt-2 text-sm leading-relaxed whitespace-pre-line text-fg-2">{{ l.description }}</p>
              </section>
            }

            <section class="mt-8">
              <h2 class="text-lg font-bold">Детайли</h2>
              <dl class="mt-3 divide-y divide-line-soft text-sm">
                @if (l.item_type !== 'magazine') {
                  <div class="flex justify-between gap-4 py-2.5"><dt class="shrink-0 text-fg-muted">Номер</dt><dd class="min-w-0 text-right font-medium break-words">{{ itemNum() }}</dd></div>
                } @else {
                  <div class="flex justify-between gap-4 py-2.5"><dt class="shrink-0 text-fg-muted">Вид</dt><dd class="min-w-0 text-right font-medium break-words">Списание</dd></div>
                }
                @if (l.element_ids?.length) {
                  <div class="flex justify-between gap-4 py-2.5">
                    <dt class="shrink-0 text-fg-muted">Номер на елемент</dt>
                    <dd class="min-w-0 text-right font-medium break-words">
                      {{ l.element_ids![0] }}
                      @if (l.element_ids!.length > 1) {
                        <span class="block text-xs font-normal text-fg-muted">също {{ l.element_ids!.slice(1).join(', ') }}</span>
                      }
                    </dd>
                  </div>
                }
                @if (l.color_name) {
                  <div class="flex justify-between gap-4 py-2.5"><dt class="shrink-0 text-fg-muted">Цвят</dt><dd class="min-w-0 text-right font-medium break-words">{{ l.color_name }}</dd></div>
                }
                @if (l.part_category) {
                  <div class="flex justify-between gap-4 py-2.5"><dt class="shrink-0 text-fg-muted">Категория</dt><dd class="min-w-0 text-right font-medium break-words">{{ l.part_category }}</dd></div>
                }
                @if (l.year) {
                  <div class="flex justify-between gap-4 py-2.5"><dt class="shrink-0 text-fg-muted">Година</dt><dd class="min-w-0 text-right font-medium break-words">{{ l.year }}</dd></div>
                }
                @if (l.num_parts) {
                  <div class="flex justify-between gap-4 py-2.5"><dt class="shrink-0 text-fg-muted">Части</dt><dd class="min-w-0 text-right font-medium break-words">{{ l.num_parts }}</dd></div>
                }
                @if (store.minifigs().length) {
                  <div class="flex justify-between gap-4 py-2.5">
                    <dt class="text-fg-muted">Минифигурки</dt><dd class="font-medium">{{ minifigCount() }}</dd>
                  </div>
                }
              </dl>
            </section>

            @if (store.otherOffers().length) {
              <section class="mt-8">
                <h2 class="text-lg font-bold">Други предложения за {{ l.item_type === 'part' ? 'тази част' : l.item_type === 'minifig' ? 'тази фигурка' : 'този сет' }}</h2>
                <ul class="mt-3 space-y-2">
                  @for (o of store.otherOffers(); track o.id) {
                    <li>
                      <a [routerLink]="['/p', o.id + '-' + slug()]" class="flex items-center justify-between rounded-xl border border-line p-3 text-sm hover:border-fg">
                        <span>
                          <b>{{ conditionLabel[o.condition!] }}</b>
                          @if (o.condition === 'used') {
                            <span class="text-fg-muted"> · {{ o.has_box ? 'с кутия' : 'без кутия' }}</span>
                          }
                        </span>
                        <span class="font-bold">{{ o.price | currency }}</span>
                      </a>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        </div>

        @if (store.minifigs().length) {
          <section class="mt-16">
            <h2 class="text-2xl font-extrabold tracking-tight">Минифигурки в сета</h2>
            <div class="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              @for (fig of store.minifigs(); track fig.fig_num) {
                <div class="rounded-2xl border border-line p-2 text-center">
                  <div class="relative aspect-square rounded-xl dark:bg-well">
                    @if (fig.img_url && !failedFigImages().has(fig.fig_num)) {
                      <img
                        [src]="fig.img_url"
                        [alt]="fig.name"
                        loading="lazy"
                        class="size-full object-contain"
                        (error)="figImageFailed(fig.fig_num)"
                      />
                    } @else {
                      <div class="grid size-full place-items-center rounded-xl bg-well text-fg-ghost" title="Няма снимка">
                        <app-icon name="image" [size]="32" />
                      </div>
                    }
                    @if (fig.quantity > 1) {
                      <span class="chip absolute top-0 right-0 bg-ink-900 text-white">×{{ fig.quantity }}</span>
                    }
                  </div>
                  <p class="mt-1 line-clamp-2 text-xs" [title]="fig.name">{{ fig.name }}</p>
                </div>
              }
            </div>
          </section>
        }

        @if (store.related().length) {
          <section class="mt-16">
            <app-product-rail
              [title]="relatedTitle()"
              [items]="store.related()"
              [loading]="false"
              [moreParams]="relatedParams()"
            />
          </section>
        }

        <!-- Phones: price + "add to cart" stay at hand once the main button has scrolled away -->
        @if (showBuyBar()) {
          <div
            class="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-surface/95 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.08)] backdrop-blur-lg lg:hidden"
          >
            <div class="min-w-0 leading-tight">
              <p class="font-display text-xl font-extrabold whitespace-nowrap">
                {{ l.price | currency }}
                @if (l.item_type === 'part') {
                  <span class="font-sans text-xs font-medium text-fg-muted">/ бр.</span>
                }
              </p>
              <p class="text-xs" [class]="available() > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-accent-strong'">
                {{ available() > 0 ? 'В наличност' : inCart() ? 'Всички са в количката' : 'Изчерпан' }}
              </p>
            </div>
            <button type="button" class="btn-primary h-11 flex-1 whitespace-nowrap" [disabled]="available() === 0" (click)="addToCart()">
              <app-icon name="cart" [size]="18" class="max-[359px]:hidden" /> Добави в количката
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class Product {
  protected readonly store = inject(ProductStore);
  private readonly cart = inject(CartStore);
  private readonly liveStock = inject(LiveStockStore);
  private readonly themes = inject(ThemesStore);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly analytics = inject(Analytics);
  private readonly seo = inject(Seo);
  /** One view event per product, not per reload of its data */
  private viewedId: number | null = null;

  /** Route param `/p/:slug`, e.g. "42-millennium-falcon" (bound via withComponentInputBinding). */
  readonly slugParam = input.required<string>({ alias: 'slug' });

  protected readonly conditionLabel = CONDITION_LABEL;
  protected readonly boxDamagedLabel = BOX_DAMAGED_LABEL;
  protected readonly activeIndex = signal(0);
  protected readonly quantity = signal(1);
  /** Minifigs whose catalog image does not load — shown with a placeholder icon */
  protected readonly failedFigImages = signal<ReadonlySet<string>>(new Set());

  private readonly id = computed(() => Number.parseInt(this.slugParam(), 10));
  protected readonly activeImage = computed(() => this.store.gallery()[this.activeIndex()] ?? null);
  protected readonly activeImageFailed = linkedSignal({ source: this.activeImage, computation: () => false });
  protected readonly itemNum = computed(() => displayItemNum(this.store.listing()?.item_num));
  protected readonly isCustom = computed(() => isCustomFigNum(this.store.listing()?.item_num));
  protected readonly slug = computed(() => slugify(this.store.listing()?.name ?? ''));
  protected readonly themePath = computed(() => this.themes.path(this.store.listing()?.theme_id));
  protected readonly minifigCount = computed(() => this.store.minifigs().reduce((n, f) => n + f.quantity, 0));
  protected readonly inCart = computed(() => this.cart.quantityOf(this.id()) > 0);
  /** Updates live when someone else orders (Realtime) */
  protected readonly stock = computed(() => {
    const l = this.store.listing();
    return l ? this.liveStock.stockOf(l) : 0;
  });
  protected readonly available = computed(() => Math.max(0, this.stock() - this.cart.quantityOf(this.id())));

  /** Top-level theme of the product, for "Още от …" */
  private readonly rootTheme = computed(() => this.themePath()[0] ?? null);
  protected readonly relatedTitle = computed(() => {
    const l = this.store.listing();
    if (this.rootTheme()) return `Още от ${this.rootTheme()!.name}`;
    return l?.part_category ? `Още ${l.part_category}` : 'Още продукти';
  });
  protected readonly relatedParams = computed((): Record<string, string> => {
    const l = this.store.listing();
    if (this.rootTheme()) return { theme: String(this.rootTheme()!.id) };
    return l?.part_cat_id != null ? { type: 'part', category: String(l.part_cat_id) } : { type: 'part' };
  });

  private readonly buyRow = viewChild<ElementRef<HTMLElement>>('buyRow');
  private readonly buyRowInView = signal(true);
  private readonly footerInView = signal(false);
  /** Phone bar with price + button: shown while neither the main button nor the footer is on screen */
  protected readonly showBuyBar = computed(() => !!this.store.listing() && !this.buyRowInView() && !this.footerInView());
  protected readonly usedDetails = computed(() => {
    const l = this.store.listing();
    if (!l) return [];
    return [
      { label: 'Кутия', ok: !!l.has_box, text: l.has_box ? 'С оригинална кутия' : 'Без кутия' },
      { label: 'Инструкции', ok: !!l.has_instructions, text: l.has_instructions ? 'С инструкции' : 'Без инструкции' },
      { label: 'Пълнота', ok: l.is_complete !== false, text: l.is_complete !== false ? 'Пълен комплект' : 'Липсват части' },
      {
        label: 'Минифигурки',
        ok: l.minifigs_complete !== false,
        text: l.minifigs_complete !== false ? 'Всички фигурки' : 'Липсват фигурки',
      },
    ];
  });

  constructor() {
    // Watch the main buy button (re-created on every product) and the footer
    effect((onCleanup) => {
      const row = this.buyRow()?.nativeElement;
      if (!row || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver((entries) => {
        for (const e of entries) (e.target === row ? this.buyRowInView : this.footerInView).set(e.isIntersecting);
      });
      observer.observe(row);
      const footer = document.querySelector('app-footer');
      if (footer) observer.observe(footer);
      onCleanup(() => observer.disconnect());
    });
    // "Още от …" once the product and the theme tree are known
    effect(() => {
      const l = this.store.listing();
      const root = this.rootTheme();
      if (!l) return;
      untracked(() => void this.store.loadRelated(l, root ? this.themes.withDescendants(root.id) : []));
    });
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.activeIndex.set(0);
        this.quantity.set(1);
        void this.store.load(id);
      });
    });
    effect(() => {
      const l = this.store.listing();
      if (!l) return;
      const color = l.color_name ? `, ${l.color_name}` : l.box_damaged ? `, ${BOX_DAMAGED_LABEL.toLowerCase()}` : '';
      // Magazines and custom minifigs have no official LEGO number
      const num = l.item_type === 'magazine' || isCustomFigNum(l.item_num) ? '' : displayItemNum(l.item_num);
      this.title.setTitle(`${l.name}${color}${num ? ` (${num})` : ''} — ${CONDITION_LABEL[l.condition!]} | ${SHOP_NAME}`);
      this.meta.updateTag({
        name: 'description',
        content: `${l.name}${num ? ` ${num}` : ''} — ${CONDITION_LABEL[l.condition!].toLowerCase()}, ${l.price} €. Наложен платеж.`,
      });
      if (l.id !== this.viewedId) {
        this.viewedId = l.id;
        untracked(() => this.analytics.viewItem({ id: l.id!, name: l.name ?? '', price: l.price ?? 0 }));
      }
    });
    // Google: one URL per product (the slug may be anything) and price/stock/condition for rich results
    effect(() => {
      const l = this.store.listing();
      if (!l) return;
      const url = `${location.origin}/p/${l.id}-${slugify(l.name ?? '')}`;
      // Magazines and custom minifigs have no official LEGO number
      const num = l.item_type === 'magazine' || isCustomFigNum(l.item_num) ? '' : displayItemNum(l.item_num);
      this.seo.setCanonical(url);
      this.seo.setJsonLd('product-jsonld', {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: l.name,
        ...(num ? { sku: num, mpn: num } : {}),
        ...(l.item_type !== 'magazine' ? { brand: { '@type': 'Brand', name: 'LEGO' } } : {}),
        image: this.store.gallery().map((src) => new URL(src, location.origin).href),
        description: l.description || `${l.name}${num ? ` ${num}` : ''} — ${CONDITION_LABEL[l.condition!].toLowerCase()}.`,
        offers: {
          '@type': 'Offer',
          url,
          price: l.price,
          priceCurrency: 'EUR',
          availability: this.stock() > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: l.condition === 'used' ? 'https://schema.org/UsedCondition' : 'https://schema.org/NewCondition',
          seller: { '@type': 'Organization', name: SHOP_NAME },
          // As on /info/returns. No shippingDetails: the courier price is agreed by phone per order
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'BG',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 14,
            returnMethod: ['https://schema.org/ReturnByMail', 'https://schema.org/ReturnInStore'],
            returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
          },
        },
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.seo.setCanonical(null);
      this.seo.setJsonLd('product-jsonld', null);
    });
  }

  protected figImageFailed(figNum: string): void {
    this.failedFigImages.update((failed) => new Set(failed).add(figNum));
  }

  protected addToCart(): void {
    const l = this.store.listing();
    if (!l) return;
    this.cart.add(l, this.store.gallery()[0] ?? null, this.quantity());
    this.quantity.set(1);
  }
}
