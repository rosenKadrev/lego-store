import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { BOX_DAMAGED_LABEL, CatalogListing, CONDITION_LABEL, displayItemNum, slugify } from '../core/models';
import { Supabase } from '../core/supabase';
import { ColorSwatch } from '../shared/color-swatch';
import { Icon } from '../shared/icon';

const MIN_CHARS = 2;
const LIMIT = 8;

type Suggestion = CatalogListing & { image: string | null };

/** Live suggestions from listings that are for sale (published, in stock). */
const SearchStore = signalStore(
  withState({ results: [] as Suggestion[], loading: false, searched: '' }),
  withMethods((store, supabase = inject(Supabase)) => {
    let requestId = 0;
    return {
      clear(): void {
        requestId++;
        patchState(store, { results: [], loading: false, searched: '' });
      },
      async search(q: string): Promise<void> {
        const term = q.trim().replace(/[,()*%]/g, ' ').trim();
        if (term.length < MIN_CHARS) {
          this.clear();
          return;
        }
        const id = ++requestId;
        patchState(store, { loading: true });
        const { data } = await supabase.client
          .from('catalog_listings')
          .select('*')
          .eq('is_published', true)
          .gt('stock', 0)
          .or(`name.ilike.*${term}*,item_num.ilike.${term}*`)
          .limit(40);
        if (id !== requestId) return;

        // Exact number first, then number/name prefix, then the rest
        const t = term.toLowerCase();
        const rank = (l: CatalogListing) => {
          const num = (l.item_num ?? '').toLowerCase();
          const name = (l.name ?? '').toLowerCase();
          if (num === t || num === `${t}-1`) return 0;
          if (num.startsWith(t)) return 1;
          if (name.startsWith(t)) return 2;
          return 3;
        };
        const results = (data ?? [])
          .sort((a, b) => rank(a) - rank(b) || (a.name ?? '').localeCompare(b.name ?? ''))
          .slice(0, LIMIT)
          .map((l) => ({ ...l, image: supabase.coverUrl(l) }));
        patchState(store, { results, loading: false, searched: term });
      },
    };
  }),
);

@Component({
  selector: 'app-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, Icon, ColorSwatch],
  providers: [SearchStore],
  host: { class: 'relative', '(document:mousedown)': 'onDocumentMouseDown($event)' },
  template: `
    <form role="search" (submit)="$event.preventDefault(); submit()">
      <app-icon name="search" [size]="18" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400" />
      <input
        #input
        type="search"
        name="q"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        [attr.aria-expanded]="showPanel()"
        aria-controls="search-suggestions"
        [attr.aria-activedescendant]="activeIndex() >= 0 ? 'search-option-' + activeIndex() : null"
        [value]="query()"
        (input)="onInput($any($event.target).value)"
        (focus)="open.set(true)"
        (keydown)="onKeydown($event)"
        placeholder="Търси сет, номер, фигурка, част…"
        class="w-full rounded-full border-0 bg-zinc-100 py-2.5 pr-4 pl-10 text-sm transition focus:bg-white focus:ring-2 focus:ring-brick-600 focus:outline-none"
        [attr.autofocus]="autofocus() ? '' : null"
      />
    </form>

    @if (showPanel()) {
      <div
        id="search-suggestions"
        role="listbox"
        class="card absolute top-full right-0 left-0 z-50 mt-2 max-h-[70vh] overflow-y-auto p-2 shadow-2xl shadow-zinc-300/60 md:-right-24 md:left-auto md:w-[28rem]"
      >
        @for (item of store.results(); track item.id; let i = $index) {
          <button
            type="button"
            role="option"
            [id]="'search-option-' + i"
            [attr.aria-selected]="i === activeIndex()"
            class="flex w-full items-center gap-3 rounded-xl p-2 text-left transition"
            [class]="i === activeIndex() ? 'bg-zinc-100' : 'hover:bg-zinc-50'"
            (mouseenter)="activeIndex.set(i)"
            (click)="openItem(item)"
          >
            <span class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-zinc-50">
              @if (item.image) {
                <img [src]="item.image" alt="" class="size-full object-contain p-1 mix-blend-multiply" (error)="$any($event.target).hidden = true" />
              }
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">{{ item.name }}</span>
              <span class="flex items-center gap-1.5 text-xs text-zinc-500">
                {{ itemNum(item.item_num) }}
                @if (item.color_name) {
                  · <app-color-swatch [rgb]="item.color_rgb" [size]="10" /> {{ item.color_name }}
                }
                ·
                <span [class]="item.condition === 'new' ? 'text-emerald-700' : 'text-amber-700'">{{ conditionLabel[item.condition!] }}</span>
                @if (item.box_damaged) { · {{ boxDamaged }} }
              </span>
            </span>
            <span class="shrink-0 text-sm font-bold">{{ item.price | currency }}</span>
          </button>
        } @empty {
          <p class="p-4 text-center text-sm text-zinc-500">
            @if (store.loading()) { Търсене… } @else { Няма продукти за „{{ query().trim() }}“. }
          </p>
        }
        @if (store.results().length) {
          <button
            type="button"
            class="mt-1 flex w-full items-center justify-center gap-1 rounded-xl border-t border-zinc-100 p-3 text-sm font-semibold text-brick-600 hover:bg-brick-50"
            (click)="submit()"
          >
            Всички резултати за „{{ query().trim() }}“ <app-icon name="arrowRight" [size]="16" />
          </button>
        }
      </div>
    }
  `,
})
export class SearchBox {
  protected readonly store = inject(SearchStore);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('input');

  readonly autofocus = input(false);

  protected readonly conditionLabel = CONDITION_LABEL;
  protected readonly boxDamaged = BOX_DAMAGED_LABEL.toLowerCase();
  protected readonly itemNum = displayItemNum;
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly showPanel = computed(() => this.open() && this.query().trim().length >= MIN_CHARS);
  private timer?: ReturnType<typeof setTimeout>;

  protected onInput(value: string): void {
    this.query.set(value);
    this.open.set(true);
    this.activeIndex.set(-1);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.store.search(value), 200);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.store.results().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        if (count) this.activeIndex.set((this.activeIndex() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.activeIndex.set((this.activeIndex() - 1 + count) % count);
        break;
      case 'Enter': {
        const item = this.store.results()[this.activeIndex()];
        if (item) {
          event.preventDefault();
          this.openItem(item);
        }
        break; // otherwise the form submits → catalog search
      }
      case 'Escape':
        // First Esc only closes the panel; the browser's own "clear search field" happens on the next one
        if (this.showPanel()) event.preventDefault();
        this.close();
        break;
    }
  }

  protected openItem(item: CatalogListing): void {
    this.close();
    this.reset();
    void this.router.navigate(['/p', `${item.id}-${slugify(item.name ?? '')}`]);
  }

  protected submit(): void {
    const q = this.query().trim();
    this.close();
    this.inputEl().nativeElement.blur();
    void this.router.navigate(['/catalog'], { queryParams: q ? { q } : {} });
  }

  protected onDocumentMouseDown(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  private close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  private reset(): void {
    clearTimeout(this.timer);
    this.query.set('');
    this.store.clear();
  }
}
