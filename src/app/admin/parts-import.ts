import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Supabase } from '../core/supabase';
import { ColorSwatch } from '../shared/color-swatch';
import { Icon } from '../shared/icon';
import { ToastStore } from '../stores/toast.store';

/** One part + colour of the set's inventory (set-parts Edge Function) */
type InventoryRow = {
  part_num: string;
  name: string;
  color_id: number;
  color_name: string;
  color_rgb: string;
  color_trans: boolean;
  img_url: string | null;
  category: string | null;
  /** LEGO element ID in this set (part + colour), as printed in the instructions */
  element_id: string | null;
  quantity: number;
  spare_quantity: number;
};

type InventoryMinifig = { fig_num: string; name: string; img_url: string | null; quantity: number };

type FigRow = InventoryMinifig & { include: boolean; price: string; inStock: number };

type Row = InventoryRow & {
  include: boolean;
  /** '' = the default price */
  price: string;
  /** new parts of this part + colour already for sale */
  inStock: number;
};

/** Sells a whole set as loose new parts: loads its inventory, then creates the listings in one go. */
@Component({
  selector: 'app-parts-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, ColorSwatch, Icon],
  template: `
    <section class="max-w-4xl">
      <h2 class="text-xl font-extrabold">Части от сет</h2>
      <p class="mt-1 text-sm text-fg-muted">
        Целият инвентар на сет като отделни нови части, а минифигурките му — като обяви за минифигурки. Обявите се
        създават скрити — публикувате ги от „Обяви“. За част или фигурка, която вече продавате нова, само се добавя
        наличност.
      </p>

      <form class="mt-5 flex flex-wrap items-end gap-3" (submit)="$event.preventDefault(); load()">
        <div class="w-full sm:w-56">
          <label class="label" for="set-num">Номер на сет</label>
          <input id="set-num" class="input" inputmode="numeric" placeholder="Напр. 10362" [value]="setNum()" (input)="setNum.set($any($event.target).value)" />
        </div>
        <button type="submit" class="btn-dark" [disabled]="loading() || setNum().trim().length < 3">
          <app-icon name="search" [size]="16" /> {{ loading() ? 'Зареждане…' : 'Зареди частите' }}
        </button>
      </form>
      @if (error()) {
        <p class="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-accent-ink">{{ error() }}</p>
      }

      @if (setName(); as name) {
        <div class="mt-6 rounded-2xl bg-surface-2 p-4">
          <p class="font-semibold">{{ name }}</p>
          <div class="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
            <div class="w-40">
              <label class="label" for="default-price">Цена на брой</label>
              <input id="default-price" class="input" type="number" min="0" step="0.01" [value]="defaultPrice()" (input)="defaultPrice.set($any($event.target).value)" />
            </div>
            <label class="flex items-center gap-2 pb-3">
              <input type="checkbox" [checked]="withSpares()" (change)="withSpares.set($any($event.target).checked)" />
              Включи резервните части
            </label>
            <div class="flex gap-3 pb-3">
              <button type="button" class="text-accent hover:underline" (click)="setAll(true)">Избери всички</button>
              <button type="button" class="text-accent hover:underline" (click)="setAll(false)">Махни всички</button>
            </div>
          </div>
          <p class="mt-1 text-xs text-fg-muted">Различна цена за отделна част (минифигурка, принтирана, голяма плоча) — в колоната „Цена“.</p>
        </div>

        @if (figs().length) {
          <h3 class="mt-6 flex flex-wrap items-end justify-between gap-3 font-bold">
            Минифигурки ({{ figs().length }})
            <span class="w-36 text-sm font-normal">
              <label class="label" for="fig-price">Цена на фигурка</label>
              <input id="fig-price" class="input" type="number" min="0" step="0.01" [value]="figPrice()" (input)="figPrice.set($any($event.target).value)" />
            </span>
          </h3>
          <ul class="mt-2 divide-y divide-line-soft">
            @for (fig of figs(); track fig.fig_num; let i = $index) {
              <li class="flex flex-wrap items-center gap-3 py-2" [class.opacity-50]="!fig.include">
                <input type="checkbox" [checked]="fig.include" (change)="patchFig(i, { include: $any($event.target).checked })" [attr.aria-label]="'Включи ' + fig.name" />
                <span class="size-12 shrink-0 rounded-lg bg-well">
                  @if (fig.img_url) {
                    <img [src]="fig.img_url" alt="" class="size-full object-contain p-1 mix-blend-multiply" loading="lazy" (error)="$any($event.target).hidden = true" />
                  }
                </span>
                <span class="min-w-0 flex-1 basis-48">
                  <span class="block truncate text-sm font-medium" [title]="fig.name">{{ fig.name }}</span>
                  <span class="text-xs text-fg-muted">
                    {{ fig.fig_num }}
                    @if (fig.inStock) { · <span class="font-semibold text-fg-3">вече имате {{ fig.inStock }} бр.</span> }
                  </span>
                </span>
                <span class="w-20 text-right text-sm tabular-nums">{{ fig.quantity }} бр.</span>
                <input
                  class="input w-24 py-1.5 text-sm"
                  type="number"
                  min="0"
                  step="0.01"
                  [placeholder]="figPrice()"
                  [value]="fig.price"
                  (input)="patchFig(i, { price: $any($event.target).value })"
                  [attr.aria-label]="'Цена за ' + fig.name"
                />
              </li>
            }
          </ul>
          <h3 class="mt-6 font-bold">Части ({{ rows().length }})</h3>
        }

        <ul class="mt-2 divide-y divide-line-soft">
          @for (row of rows(); track row.part_num + '|' + row.color_id; let i = $index) {
            <li class="flex flex-wrap items-center gap-3 py-2" [class.opacity-50]="!row.include">
              <input type="checkbox" [checked]="row.include" (change)="patch(i, { include: $any($event.target).checked })" [attr.aria-label]="'Включи ' + row.name" />
              <span class="size-12 shrink-0 rounded-lg bg-well">
                @if (row.img_url) {
                  <img [src]="row.img_url" alt="" class="size-full object-contain p-1 mix-blend-multiply" loading="lazy" (error)="$any($event.target).hidden = true" />
                }
              </span>
              <span class="min-w-0 flex-1 basis-48">
                <span class="block truncate text-sm font-medium" [title]="row.name">{{ row.name }}</span>
                <span class="flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
                  {{ row.part_num }}
                  @if (row.element_id) { · елемент <span class="font-semibold text-fg-3">{{ row.element_id }}</span> }
                  · <app-color-swatch [rgb]="row.color_rgb" [trans]="row.color_trans" [size]="12" /> {{ row.color_name }}
                  @if (row.inStock) { · <span class="font-semibold text-fg-3">вече имате {{ row.inStock }} бр.</span> }
                </span>
              </span>
              <span class="w-20 text-right text-sm tabular-nums">
                {{ qty(row) }} бр.
                @if (row.spare_quantity) {
                  <span class="block text-xs text-fg-faint">{{ withSpares() ? 'вкл.' : '+' }} {{ row.spare_quantity }} рез.</span>
                }
              </span>
              <input
                class="input w-24 py-1.5 text-sm"
                type="number"
                min="0"
                step="0.01"
                [placeholder]="defaultPrice()"
                [value]="row.price"
                (input)="patch(i, { price: $any($event.target).value })"
                [attr.aria-label]="'Цена за ' + row.name"
              />
            </li>
          }
        </ul>

        <div class="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-page py-4">
          <p class="text-sm">
            <b>{{ summary().lots }}</b> вида · <b>{{ summary().pieces }}</b> бр. · стойност <b>{{ summary().value | currency }}</b>
          </p>
          <button type="button" class="btn-primary" [disabled]="saving() || !summary().lots || invalidPrice()" (click)="create()">
            {{ saving() ? 'Създаване…' : 'Създай обявите' }}
          </button>
        </div>
        @if (invalidPrice()) {
          <p class="text-sm text-accent">Въведете цена на брой (0 или повече).</p>
        }
      }

      @if (done(); as result) {
        <div class="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Готово: {{ result.created }} нови обяви (скрити) и {{ result.updated }} с добавена наличност.
          <a routerLink="/admin/listings" class="ml-1 font-semibold underline">Към обявите</a>
        </div>
      }
    </section>
  `,
})
export class PartsImport {
  private readonly db = inject(Supabase).client;
  private readonly toast = inject(ToastStore);

  protected readonly setNum = signal('');
  protected readonly setName = signal<string | null>(null);
  protected readonly rows = signal<Row[]>([]);
  protected readonly figs = signal<FigRow[]>([]);
  protected readonly defaultPrice = signal('0.10');
  protected readonly figPrice = signal('5.00');
  protected readonly withSpares = signal(true);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal<{ created: number; updated: number } | null>(null);

  protected readonly invalidPrice = computed(() =>
    [this.defaultPrice(), this.figPrice()].some((p) => p.trim() === '' || !(Number(p) >= 0)),
  );

  protected readonly summary = computed(() => {
    let lots = 0;
    let pieces = 0;
    let value = 0;
    for (const row of this.rows()) {
      if (!row.include) continue;
      const qty = this.qty(row);
      lots++;
      pieces += qty;
      value += qty * this.price(row);
    }
    for (const fig of this.figs()) {
      if (!fig.include) continue;
      lots++;
      pieces += fig.quantity;
      value += fig.quantity * this.figPriceOf(fig);
    }
    return { lots, pieces, value: Math.round(value * 100) / 100 };
  });

  protected qty(row: Row): number {
    return row.quantity + (this.withSpares() ? row.spare_quantity : 0);
  }

  private price(row: Row): number {
    const own = row.price.trim();
    return Number(own === '' ? this.defaultPrice() : own) || 0;
  }

  private figPriceOf(fig: FigRow): number {
    const own = fig.price.trim();
    return Number(own === '' ? this.figPrice() : own) || 0;
  }

  protected patchFig(index: number, changes: Partial<FigRow>): void {
    this.figs.update((figs) => figs.map((f, i) => (i === index ? { ...f, ...changes } : f)));
  }

  protected patch(index: number, changes: Partial<Row>): void {
    this.rows.update((rows) => rows.map((r, i) => (i === index ? { ...r, ...changes } : r)));
  }

  protected setAll(include: boolean): void {
    this.rows.update((rows) => rows.map((r) => ({ ...r, include })));
    this.figs.update((figs) => figs.map((f) => ({ ...f, include })));
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.done.set(null);
    const { data, error } = await this.db.functions.invoke<{ set: { num: string; name: string }; parts: InventoryRow[]; minifigs: InventoryMinifig[] }>(
      'set-parts',
      { body: { num: this.setNum().trim() } },
    );
    if (error || !data?.parts) {
      this.loading.set(false);
      const message = error && 'context' in error ? ((await (error.context as Response).json().catch(() => null))?.error as string | undefined) : undefined;
      this.error.set(message ?? 'Инвентарът не можа да бъде зареден.');
      return;
    }

    // What's already for sale as new, so the admin sees stock will be added rather than a new listing made
    const partNums = [...new Set(data.parts.map((p) => p.part_num))];
    const { data: existing } = await this.db
      .from('listings')
      .select('part_num, color_id, stock')
      .eq('item_type', 'part')
      .eq('condition', 'new')
      .in('part_num', partNums);
    const stock = new Map<string, number>();
    for (const l of existing ?? []) stock.set(`${l.part_num}|${l.color_id}`, (stock.get(`${l.part_num}|${l.color_id}`) ?? 0) + l.stock);
    const figNums = (data.minifigs ?? []).map((f) => f.fig_num);
    const { data: existingFigs } = figNums.length
      ? await this.db.from('listings').select('fig_num, stock').eq('item_type', 'minifig').eq('condition', 'new').in('fig_num', figNums)
      : { data: [] };
    const figStock = new Map<string, number>();
    for (const l of existingFigs ?? []) figStock.set(l.fig_num!, (figStock.get(l.fig_num!) ?? 0) + l.stock);
    this.figs.set((data.minifigs ?? []).map((f) => ({ ...f, include: true, price: '', inStock: figStock.get(f.fig_num) ?? 0 })));

    this.setName.set(`${data.set.num.replace(/-1$/, '')} ${data.set.name}`);
    this.rows.set(
      data.parts
        .map((p) => ({ ...p, include: true, price: '', inStock: stock.get(`${p.part_num}|${p.color_id}`) ?? 0 }))
        .sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name) || a.color_name.localeCompare(b.color_name)),
    );
    this.loading.set(false);
  }

  protected async create(): Promise<void> {
    const items = this.rows()
      .filter((r) => r.include && this.qty(r) > 0)
      .map((r) => ({ part_num: r.part_num, color_id: r.color_id, quantity: this.qty(r), price: this.price(r) }));
    const minifigs = this.figs()
      .filter((f) => f.include && f.quantity > 0)
      .map((f) => ({ fig_num: f.fig_num, quantity: f.quantity, price: this.figPriceOf(f) }));
    if (!items.length && !minifigs.length) return;
    this.saving.set(true);
    const { data, error } = await this.db.rpc('import_set_inventory', { p_parts: items, p_minifigs: minifigs, p_condition: 'new' });
    this.saving.set(false);
    if (error || !data?.[0]) {
      this.toast.error('Обявите не бяха създадени.');
      return;
    }
    this.done.set(data[0]);
    this.toast.success(`${data[0].created + data[0].updated} обяви са създадени или допълнени.`);
    this.setName.set(null);
    this.rows.set([]);
    this.figs.set([]);
  }
}
