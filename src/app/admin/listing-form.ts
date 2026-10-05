import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CONDITION_LABEL, displayItemNum, ItemCondition, ItemType, slugify } from '../core/models';
import { Supabase } from '../core/supabase';
import { ColorSwatch } from '../shared/color-swatch';
import { Icon } from '../shared/icon';
import { CatalogItem, ListingFormStore, PartColorOption } from './listing-form.store';

@Component({
  selector: 'app-listing-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, Icon, ColorSwatch],
  providers: [ListingFormStore],
  template: `
    <a routerLink="/admin/listings" class="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-ink-900">
      <app-icon name="chevronLeft" [size]="16" /> Всички обяви
    </a>

    @if (store.loading()) {
      <div class="h-64 animate-pulse rounded-3xl bg-zinc-100"></div>
    } @else {
      <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div class="space-y-6">
          <!-- Step 1: catalog item -->
          <section class="card p-5 sm:p-6">
            <h2 class="text-lg font-bold">{{ isEdit() ? 'Продукт' : '1. Избери продукт от каталога' }}</h2>

            @if (store.item(); as item) {
              <div class="mt-4 flex items-center gap-4 rounded-2xl bg-zinc-50 p-3">
                <div class="size-20 shrink-0 rounded-xl bg-white">
                  @if (item.img_url) {
                    <img [src]="item.img_url" alt="" class="size-full object-contain p-1" />
                  }
                </div>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold">{{ item.name }}</p>
                  <p class="text-sm text-zinc-500">
                    {{ itemNum(item.num) }}
                    @if (item.theme_name) { · {{ item.theme_name }} }
                    @if (item.year) { · {{ item.year }} }
                    @if (item.type !== 'part') { · {{ item.num_parts }} части }
                  </p>
                  @if (item.color_name) {
                    <p class="mt-1 flex items-center gap-1.5 text-sm font-medium">
                      <app-color-swatch [rgb]="item.color_rgb" [size]="16" /> {{ item.color_name }}
                      @if (!isEdit()) {
                        <button type="button" class="ml-1 text-xs text-brick-600 hover:underline" (click)="store.selectItem({ ...item, color_id: null, color_name: null, color_rgb: null })">
                          смени цвета
                        </button>
                      }
                    </p>
                  }
                </div>
                @if (!isEdit()) {
                  <button type="button" class="btn-ghost" (click)="store.selectItem(null)">Смени</button>
                }
              </div>

              @if (item.type === 'part' && item.color_id == null) {
                <div class="mt-4">
                  <p class="label">Изберете цвят</p>
                  @if (store.partColors().length) {
                    <p class="mb-2 text-xs text-zinc-500">Цветове, в които частта се среща в сетове:</p>
                    <div class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      @for (c of store.partColors(); track c.id) {
                        <button
                          type="button"
                          class="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 p-2 text-center text-xs hover:border-brick-600"
                          (click)="chooseColor(c)"
                        >
                          <span class="grid aspect-square w-full place-items-center rounded-lg bg-zinc-50">
                            @if (c.img_url) {
                              <img [src]="c.img_url" alt="" loading="lazy" class="size-full object-contain p-1 mix-blend-multiply" />
                            } @else {
                              <app-color-swatch [rgb]="c.rgb" [trans]="c.is_trans" [size]="28" />
                            }
                          </span>
                          <span class="flex items-center gap-1"><app-color-swatch [rgb]="c.rgb" [trans]="c.is_trans" [size]="10" /> {{ c.name }}</span>
                        </button>
                      }
                    </div>
                  }
                  <label class="mt-3 block text-xs text-zinc-500" for="other-color">Друг цвят:</label>
                  <select id="other-color" class="input mt-1 sm:w-72" (change)="chooseOtherColor($any($event.target).value)">
                    <option value="">— избери —</option>
                    @for (c of store.allColors(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </div>
              }

              @if (store.existingOffers().length) {
                <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p class="font-semibold text-amber-900">Вече има обяви за този продукт:</p>
                  <ul class="mt-1 space-y-1">
                    @for (o of store.existingOffers(); track o.id) {
                      <li>
                        <a [routerLink]="['/admin/listings', o.id]" class="underline">
                          {{ conditionLabel[o.condition!] }}{{ o.box_damaged ? ', ударена кутия' : '' }} · {{ o.price | currency }} · {{ o.stock }} бр.{{ o.is_published ? '' : ' (чернова)' }}
                        </a>
                      </li>
                    }
                  </ul>
                  @if (hasNewOffer() && form.value.condition === 'new' && !boxDamaged()) {
                    <p class="mt-2 text-amber-900">За нови бройки по-добре увеличете наличността на съществуващата обява.</p>
                  }
                </div>
              }
            } @else {
              <div class="mt-4 grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1 text-sm sm:w-72">
                @for (t of types; track t.value) {
                  <button
                    type="button"
                    class="rounded-full px-3 py-2 font-medium"
                    [class]="searchType() === t.value ? 'bg-white shadow-sm' : 'text-zinc-600'"
                    (click)="setSearchType(t.value)"
                  >
                    {{ t.label }}
                  </button>
                }
              </div>
              <div class="relative mt-3">
                <app-icon name="search" [size]="18" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  class="input pl-10"
                  [placeholder]="searchPlaceholder()"
                  (input)="search($any($event.target).value)"
                  autofocus
                />
              </div>
              @if (store.searching()) {
                <p class="mt-3 text-sm text-zinc-500">Търсене…</p>
              }
              <ul class="mt-3 max-h-112 divide-y divide-zinc-100 overflow-y-auto">
                @for (r of store.results(); track r.num) {
                  <li>
                    <button type="button" class="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-zinc-50" (click)="choose(r)">
                      <span class="size-14 shrink-0 rounded-lg bg-zinc-50">
                        @if (r.img_url) {
                          <img [src]="r.img_url" alt="" class="size-full object-contain p-1 mix-blend-multiply" loading="lazy" />
                        }
                      </span>
                      <span class="min-w-0">
                        <span class="block truncate font-medium">{{ r.name }}</span>
                        <span class="text-xs text-zinc-500">
                          {{ itemNum(r.num) }} @if (r.theme_name) { · {{ r.theme_name }} } @if (r.year) { · {{ r.year }} }
                        </span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
              @if (canLookup()) {
                <div class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4 text-sm">
                  <span class="text-zinc-600">
                    @if (store.results().length) { Не е този? } @else { Няма „{{ term() }}“ в каталога. }
                    Нови сетове се появяват тук след седмичното обновяване.
                  </span>
                  <button type="button" class="btn-dark" [disabled]="store.searching()" (click)="lookup()">
                    <app-icon name="search" [size]="16" /> Търси „{{ term() }}“ в Rebrickable
                  </button>
                </div>
              }
              @if (store.error() && !store.item()) {
                <p class="mt-3 rounded-xl bg-brick-50 p-3 text-sm text-brick-800">{{ store.error() }}</p>
              }
            }
          </section>

          @if (store.item() && (store.item()!.type !== 'part' || store.item()!.color_id != null)) {
            <!-- Step 2: offer -->
            <form [formGroup]="form" (ngSubmit)="save()" class="card space-y-5 p-5 sm:p-6" novalidate>
              <h2 class="text-lg font-bold">{{ isEdit() ? 'Обява' : '2. Детайли на обявата' }}</h2>

              <div class="grid grid-cols-2 gap-3">
                @for (c of conditions; track c) {
                  <label
                    class="flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4"
                    [class]="condition() === c ? 'border-brick-600 bg-brick-50' : 'border-zinc-200'"
                  >
                    <input type="radio" formControlName="condition" [value]="c" class="accent-brick-600" />
                    <span class="font-semibold">{{ conditionLabel[c] }}</span>
                  </label>
                }
              </div>

              <div class="grid gap-4 sm:grid-cols-3">
                <div>
                  <label class="label" for="price">Цена (€)</label>
                  <input id="price" class="input" type="number" step="0.01" min="0" formControlName="price" />
                </div>
                <div>
                  <label class="label" for="compare">Стара цена (€)</label>
                  <input id="compare" class="input" type="number" step="0.01" min="0" formControlName="compare_at_price" placeholder="—" />
                </div>
                <div>
                  <label class="label" for="stock">Наличност</label>
                  @if (condition() === 'used' && store.item()?.type !== 'part') {
                    <select id="stock" class="input" formControlName="stock">
                      <option [ngValue]="1">Налична (1)</option>
                      <option [ngValue]="0">Продадена (0)</option>
                    </select>
                  } @else {
                    <input id="stock" class="input" type="number" min="0" step="1" formControlName="stock" />
                  }
                </div>
              </div>
              @if (form.controls.compare_at_price.value != null && form.controls.price.value != null && form.controls.compare_at_price.value <= form.controls.price.value) {
                <p class="field-error -mt-3">Старата цена трябва да е по-висока от цената.</p>
              }

              @if (condition() === 'new' && store.item()?.type === 'set') {
                <div class="rounded-2xl border p-4" [class]="boxDamaged() ? 'border-amber-300 bg-amber-50' : 'border-zinc-200'">
                  <label class="flex items-start gap-3 text-sm">
                    <input type="checkbox" formControlName="box_damaged" class="mt-0.5 size-4 accent-amber-600" />
                    <span>
                      <span class="block font-semibold">Ударена кутия</span>
                      <span class="text-zinc-500">Сетът е нов и запечатан, но кутията има козметични наранявания.</span>
                    </span>
                  </label>
                  @if (boxDamaged()) {
                    <label class="label mt-3" for="box-notes">Какво има по кутията <span class="font-normal text-zinc-400">(по избор)</span></label>
                    <input id="box-notes" class="input" formControlName="condition_notes" placeholder="Напр. смачкан ъгъл, драскотина на гърба" />
                  }
                </div>
              }

              @if (condition() === 'used') {
                <fieldset class="grid gap-2 sm:grid-cols-2" [class.hidden]="store.item()?.type !== 'set'">
                  <legend class="label">Състояние</legend>
                  @for (flag of usedFlags; track flag.key) {
                    <label class="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 text-sm">
                      <input type="checkbox" [formControlName]="flag.key" class="size-4 accent-brick-600" />
                      {{ flag.label }}
                    </label>
                  }
                </fieldset>
                <div>
                  <label class="label" for="notes">Бележки за състоянието</label>
                  <textarea id="notes" class="input min-h-20" formControlName="condition_notes" placeholder="Напр. леки драскотини по стикерите, кутията е отваряна"></textarea>
                </div>
              }

              <div>
                <label class="label" for="description">Описание <span class="font-normal text-zinc-400">(по избор)</span></label>
                <textarea id="description" class="input min-h-24" formControlName="description"></textarea>
              </div>

              <label class="flex items-center gap-3 text-sm font-medium">
                <input type="checkbox" formControlName="is_published" class="size-4 accent-brick-600" />
                Публикувана (видима в магазина)
              </label>

              @if (store.error()) {
                <p class="rounded-xl bg-brick-50 p-3 text-sm text-brick-800">{{ store.error() }}</p>
              }
              @if (savedMessage()) {
                <p class="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{{ savedMessage() }}</p>
              }

              <div class="flex flex-wrap gap-3">
                <button type="submit" class="btn-primary" [disabled]="form.invalid || store.saving()">
                  {{ store.saving() ? 'Запис…' : isEdit() ? 'Запази промените' : 'Създай обявата' }}
                </button>
                @if (isEdit()) {
                  <a [routerLink]="['/p', store.listing()!.id + '-' + slug()]" class="btn-outline" target="_blank">Виж в магазина</a>
                  <button type="button" class="btn-ghost text-brick-700 sm:ml-auto" (click)="remove()">
                    <app-icon name="trash" [size]="18" /> Изтрий
                  </button>
                }
              </div>
            </form>
          }
        </div>

        <!-- Photos -->
        @if (store.item()) {
          <aside class="card h-fit p-5 sm:p-6 lg:sticky lg:top-32">
            <h2 class="text-lg font-bold">Снимки</h2>
            <p class="mt-1 text-xs text-zinc-500">
              Първата снимка е корица. Без собствени снимки се показва каталожната. За употребявани качвайте реални снимки.
            </p>
            @if (!store.listing()) {
              <p class="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">Създайте обявата, за да добавите снимки.</p>
            } @else {
              <div class="mt-4 grid grid-cols-3 gap-2">
                @for (img of store.images(); track img.id; let i = $index; let last = $last) {
                  <div class="group relative aspect-square overflow-hidden rounded-xl bg-zinc-50">
                    <img [src]="imageUrl(img.path)" alt="" class="size-full object-cover" />
                    @if (i === 0) {
                      <span class="chip absolute top-1 left-1 bg-ink-900 text-[10px] text-white">Корица</span>
                    }
                    <div class="absolute inset-x-0 bottom-0 flex justify-between bg-ink-900/70 p-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <button type="button" class="text-white disabled:opacity-30" [disabled]="i === 0" aria-label="Наляво" (click)="store.moveImage(i, -1)">
                        <app-icon name="chevronLeft" [size]="16" />
                      </button>
                      <button type="button" class="text-white" aria-label="Изтрий снимката" (click)="store.deleteImage(img)">
                        <app-icon name="trash" [size]="16" />
                      </button>
                      <button type="button" class="text-white disabled:opacity-30" [disabled]="last" aria-label="Надясно" (click)="store.moveImage(i, 1)">
                        <app-icon name="chevronRight" [size]="16" />
                      </button>
                    </div>
                  </div>
                }
                <label
                  class="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-brick-600 hover:text-brick-600"
                >
                  <app-icon [name]="store.uploading() ? 'refresh' : 'upload'" [class.animate-spin]="store.uploading()" />
                  {{ store.uploading() ? 'Качване…' : 'Добави' }}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="sr-only" (change)="upload($event)" [disabled]="store.uploading()" />
                </label>
              </div>
            }
          </aside>
        }
      </div>
    }
  `,
})
export class ListingForm {
  protected readonly store = inject(ListingFormStore);
  private readonly supabase = inject(Supabase);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  /** Route param on /admin/listings/:id; undefined on /admin/listings/new. */
  readonly id = input<string>();

  protected readonly conditionLabel = CONDITION_LABEL;
  protected readonly itemNum = displayItemNum;
  protected readonly conditions: ItemCondition[] = ['new', 'used'];
  protected readonly types: { value: ItemType; label: string }[] = [
    { value: 'set', label: 'Сет' },
    { value: 'minifig', label: 'Минифигурка' },
    { value: 'part', label: 'Част' },
  ];
  protected readonly usedFlags = [
    { key: 'has_box', label: 'С оригинална кутия' },
    { key: 'has_instructions', label: 'С инструкции' },
    { key: 'is_complete', label: 'Пълен комплект (всички части)' },
    { key: 'minifigs_complete', label: 'Всички минифигурки' },
  ] as const;

  protected readonly form = this.fb.group({
    condition: this.fb.nonNullable.control<ItemCondition>('new'),
    price: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    compare_at_price: this.fb.control<number | null>(null),
    stock: this.fb.nonNullable.control(1, [Validators.required, Validators.min(0)]),
    has_box: this.fb.nonNullable.control(true),
    has_instructions: this.fb.nonNullable.control(true),
    is_complete: this.fb.nonNullable.control(true),
    minifigs_complete: this.fb.nonNullable.control(true),
    condition_notes: this.fb.nonNullable.control(''),
    box_damaged: this.fb.nonNullable.control(false),
    description: this.fb.nonNullable.control(''),
    is_published: this.fb.nonNullable.control(true),
  });

  protected readonly isEdit = computed(() => !!this.id());
  protected readonly searchType = signal<ItemType>('set');
  protected readonly term = signal('');
  /** Offer the Rebrickable lookup for anything that looks like an item number, once the local search finished. */
  protected readonly canLookup = computed(() => {
    const t = this.term();
    if (this.store.searching() || t.length < 3 || this.searchType() === 'part') return false;
    const looksLikeNumber = this.searchType() === 'set' ? /^\d{3,}(-\d+)?$/.test(t) : /^fig-\d+$/i.test(t);
    const exactLocal = this.store.results().some((r) => r.num === t || r.num === `${t}-1`);
    return looksLikeNumber && !exactLocal;
  });
  protected readonly searchPlaceholder = computed(() => {
    switch (this.searchType()) {
      case 'set':
        return 'Номер (75192) или име на сет';
      case 'minifig':
        return 'Номер (fig-0001) или име на фигурка';
      default:
        return 'Номер на част (3001), номер на елемент (300121) или име';
    }
  });
  protected readonly savedMessage = signal<string | null>(null);
  protected readonly condition = toSignal(this.form.controls.condition.valueChanges, { initialValue: 'new' as ItemCondition });
  protected readonly boxDamaged = toSignal(this.form.controls.box_damaged.valueChanges, { initialValue: false });
  protected readonly hasNewOffer = computed(() => this.store.existingOffers().some((o) => o.condition === 'new' && !o.box_damaged));
  protected readonly slug = computed(() => slugify(this.store.item()?.name ?? ''));
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(async () => {
        if (!id) {
          this.store.reset();
          return;
        }
        await this.store.load(id);
        const l = this.store.listing();
        if (l) {
          this.form.reset({
            condition: l.condition,
            price: l.price,
            compare_at_price: l.compare_at_price,
            stock: l.stock,
            has_box: l.has_box ?? true,
            has_instructions: l.has_instructions ?? true,
            is_complete: l.is_complete ?? true,
            minifigs_complete: l.minifigs_complete ?? true,
            condition_notes: l.condition_notes ?? '',
            box_damaged: l.box_damaged,
            description: l.description ?? '',
            is_published: l.is_published,
          });
        }
      });
    });

    // A used set/minifig is a single physical piece (used parts are sold in any quantity)
    this.form.controls.condition.valueChanges.subscribe((c) => {
      if (c === 'used' && this.store.item()?.type !== 'part' && this.form.controls.stock.value > 1) {
        this.form.controls.stock.setValue(1);
      }
    });
  }

  protected setSearchType(type: ItemType): void {
    this.searchType.set(type);
    void this.store.search(type, '');
  }

  protected search(q: string): void {
    this.term.set(q.trim());
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.store.search(this.searchType(), q), 250);
  }

  protected lookup(): void {
    void this.store.lookupRebrickable(this.searchType(), this.term());
  }

  protected choose(item: CatalogItem): void {
    void this.store.selectItem(item);
  }

  protected chooseColor(color: PartColorOption): void {
    void this.store.chooseColor(color);
  }

  protected chooseOtherColor(id: string): void {
    const color = this.store.allColors().find((c) => c.id === Number(id));
    if (color) void this.store.chooseColor(color);
  }

  protected imageUrl(path: string): string {
    return this.supabase.listingImageUrl(path);
  }

  protected async save(): Promise<void> {
    const item = this.store.item();
    if (!item || this.form.invalid) return;
    const v = this.form.getRawValue();
    if (v.compare_at_price != null && v.price != null && v.compare_at_price <= v.price) return;
    const used = v.condition === 'used';
    const isSet = item.type === 'set';
    if (item.type === 'part' && item.color_id == null) return;
    this.savedMessage.set(null);

    const id = await this.store.save({
      item_type: item.type,
      set_num: item.type === 'set' ? item.num : null,
      fig_num: item.type === 'minifig' ? item.num : null,
      part_num: item.type === 'part' ? item.num : null,
      color_id: item.type === 'part' ? (item.color_id ?? null) : null,
      condition: v.condition,
      price: v.price!,
      compare_at_price: v.compare_at_price || null,
      stock: used && item.type !== 'part' ? Math.min(v.stock, 1) : v.stock,
      has_box: used && isSet ? v.has_box : null,
      has_instructions: used && isSet ? v.has_instructions : null,
      is_complete: used && isSet ? v.is_complete : null,
      minifigs_complete: used && isSet ? v.minifigs_complete : null,
      box_damaged: isSet && !used && v.box_damaged,
      condition_notes: used || (isSet && v.box_damaged) ? v.condition_notes.trim() || null : null,
      description: v.description.trim() || null,
      is_published: v.is_published,
    });
    if (id == null) return;

    if (this.isEdit()) {
      this.savedMessage.set('Промените са запазени.');
      this.form.markAsPristine();
    } else {
      // Continue on the edit page so photos can be added
      void this.router.navigate(['/admin/listings', id], { replaceUrl: true });
    }
  }

  protected async remove(): Promise<void> {
    if (!confirm('Да изтрия ли обявата? Това не може да бъде отменено.')) return;
    if (await this.store.remove()) void this.router.navigate(['/admin/listings']);
  }

  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) void this.store.upload(input.files).then(() => (input.value = ''));
  }
}
