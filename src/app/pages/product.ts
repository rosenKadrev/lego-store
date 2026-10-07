import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { BOX_DAMAGED_LABEL, CONDITION_LABEL, displayItemNum, SHOP_NAME, slugify } from '../core/models';
import { ColorSwatch } from '../shared/color-swatch';
import { FavoriteButton } from '../shared/favorite-button';
import { Icon } from '../shared/icon';
import { QuantityStepper } from '../shared/quantity-stepper';
import { CartStore } from '../stores/cart.store';
import { ProductStore } from '../stores/product.store';
import { ThemesStore } from '../stores/themes.store';

@Component({
  selector: 'app-product',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, Icon, QuantityStepper, ColorSwatch, FavoriteButton],
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
          @for (t of themePath(); track t.id) {
            <app-icon name="chevronRight" [size]="14" />
            <a routerLink="/catalog" [queryParams]="{ theme: t.id }" class="hover:text-fg">{{ t.name }}</a>
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
              @if (activeImage(); as src) {
                <img [src]="src" [alt]="l.name" class="absolute inset-0 size-full object-contain p-6 mix-blend-multiply sm:p-10" />
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
              {{ l.theme_name ?? l.part_category ?? 'Минифигурка' }} · {{ itemNum() }}
            </p>
            <h1 class="mt-2 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">{{ l.name }}</h1>
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
              @if ((l.stock ?? 0) === 0) {
                Изчерпан
              } @else if (l.item_type === 'part') {
                Налични {{ l.stock }} бр.
              } @else if (l.condition === 'used') {
                Единствена бройка
              } @else if ((l.stock ?? 0) <= 3) {
                Остават само {{ l.stock }} бр.
              } @else {
                В наличност
              }
            </p>

            <div class="mt-6 flex flex-wrap items-center gap-3">
              @if ((l.stock ?? 0) > 1) {
                <app-quantity-stepper [large]="true" [value]="quantity()" [min]="1" [max]="available()" (valueChange)="quantity.set($event)" />
              }
              <button type="button" class="btn-primary h-11 flex-1 text-base sm:flex-none sm:px-10" [disabled]="available() === 0" (click)="addToCart()">
                <app-icon name="cart" [size]="20" />
                {{ available() === 0 && inCart() ? 'Всички бройки са в количката' : 'Добави в количката' }}
              </button>
              <app-favorite-button [listing]="l" [large]="true" />
            </div>

            <ul class="mt-6 grid gap-2 rounded-2xl bg-surface-2 p-4 text-sm sm:grid-cols-2">
              <li class="flex items-center gap-2"><app-icon name="cash" [size]="18" class="text-accent" /> Плащане с наложен платеж</li>
              <li class="flex items-center gap-2"><app-icon name="eye" [size]="18" class="text-accent" /> Преглед преди плащане</li>
              <li class="flex items-center gap-2"><app-icon name="truck" [size]="18" class="text-accent" /> Еконт или Спиди, 1–2 дни</li>
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
                <div class="flex justify-between gap-4 py-2.5"><dt class="shrink-0 text-fg-muted">Номер</dt><dd class="min-w-0 text-right font-medium break-words">{{ itemNum() }}</dd></div>
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
                    @if (fig.img_url) {
                      <img [src]="fig.img_url" [alt]="fig.name" loading="lazy" class="size-full object-contain" />
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
      }
    </div>
  `,
})
export class Product {
  protected readonly store = inject(ProductStore);
  private readonly cart = inject(CartStore);
  private readonly themes = inject(ThemesStore);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  /** Route param `/p/:slug`, e.g. "42-millennium-falcon" (bound via withComponentInputBinding). */
  readonly slugParam = input.required<string>({ alias: 'slug' });

  protected readonly conditionLabel = CONDITION_LABEL;
  protected readonly boxDamagedLabel = BOX_DAMAGED_LABEL;
  protected readonly activeIndex = signal(0);
  protected readonly quantity = signal(1);

  private readonly id = computed(() => Number.parseInt(this.slugParam(), 10));
  protected readonly activeImage = computed(() => this.store.gallery()[this.activeIndex()] ?? null);
  protected readonly itemNum = computed(() => displayItemNum(this.store.listing()?.item_num));
  protected readonly slug = computed(() => slugify(this.store.listing()?.name ?? ''));
  protected readonly themePath = computed(() => this.themes.path(this.store.listing()?.theme_id));
  protected readonly minifigCount = computed(() => this.store.minifigs().reduce((n, f) => n + f.quantity, 0));
  protected readonly inCart = computed(() => this.cart.quantityOf(this.id()) > 0);
  protected readonly available = computed(
    () => Math.max(0, (this.store.listing()?.stock ?? 0) - this.cart.quantityOf(this.id())),
  );
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
      this.title.setTitle(`${l.name}${color} (${displayItemNum(l.item_num)}) — ${CONDITION_LABEL[l.condition!]} | ${SHOP_NAME}`);
      this.meta.updateTag({
        name: 'description',
        content: `${l.name} ${displayItemNum(l.item_num)} — ${CONDITION_LABEL[l.condition!].toLowerCase()}, ${l.price} €. Наложен платеж.`,
      });
    });
  }

  protected addToCart(): void {
    const l = this.store.listing();
    if (!l) return;
    this.cart.add(l, this.store.gallery()[0] ?? null, this.quantity());
    this.quantity.set(1);
  }
}
