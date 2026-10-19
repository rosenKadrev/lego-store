import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Icon } from '../shared/icon';
import { Pager, pagedList } from '../shared/pager';
import { ThemesStore } from '../stores/themes.store';

/** Kinds the page can be narrowed to (?type=minifig) — from the "Минифигурки ▾" / "Списания ▾" menus */
const KINDS = {
  minifig: { title: 'Теми на минифигурки', count: 'теми с налични минифигурки', products: 'минифигурки' },
  magazine: { title: 'Теми на списания', count: 'теми с налични списания', products: 'списания' },
} as const;
type Kind = keyof typeof KINDS;

/** All top-level themes that currently have products for sale (or minifigs / magazines only). */
@Component({
  selector: 'app-themes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Pager],
  template: `
    <div class="container-page pt-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ kind() ? kinds[kind()!].title : 'Всички теми' }}</h1>
          <p class="mt-1 text-sm text-fg-muted">
            {{ list().length }} {{ kind() ? kinds[kind()!].count : 'теми с налични продукти' }}
            @if (kind(); as k) {
              · <a routerLink="/catalog" [queryParams]="{ type: k }" class="font-semibold text-accent hover:underline">Всички {{ kinds[k].products }}</a>
              · <a routerLink="/themes" class="font-semibold text-accent hover:underline">Всички теми</a>
            }
          </p>
        </div>
        <div class="relative w-full sm:w-72">
          <app-icon name="search" [size]="18" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-faint" />
          <input
            type="search"
            class="input rounded-full pl-10"
            placeholder="Търси тема…"
            aria-label="Търси тема"
            [value]="query()"
            (input)="search($any($event.target).value)"
          />
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        @for (theme of paged.items(); track theme.theme_id) {
          <a
            routerLink="/catalog"
            [queryParams]="{ type: kind(), theme: theme.theme_id }"
            class="group flex flex-col items-center gap-2 rounded-2xl border border-line p-4 text-center transition hover:border-brick-600 hover:shadow-lg"
          >
            <span class="grid aspect-square w-full place-items-center overflow-hidden rounded-xl dark:bg-well">
              @if (themes.image(theme, kind()); as img) {
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
            <span class="text-xs text-fg-muted">{{ theme.listing_count }} {{ kind() ? kinds[kind()!].products : 'продукта' }}</span>
          </a>
        } @empty {
          <p class="col-span-full py-16 text-center text-sm text-fg-muted">
            @if (query()) { Няма тема „{{ query() }}“. } @else { Все още няма продукти. }
          </p>
        }
      </div>

      <app-pager [page]="paged.page()" [pageCount]="paged.pageCount()" (pageChange)="paged.goTo($event)" />
    </div>
  `,
})
export class Themes {
  protected readonly themes = inject(ThemesStore);
  protected readonly kinds = KINDS;
  protected readonly kind = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => (params.get('type') ?? '') in KINDS ? (params.get('type') as Kind) : null)),
    { initialValue: null },
  );
  /** Counts only that kind when narrowed */
  protected readonly list = computed(() => {
    const kind = this.kind();
    return kind ? this.themes.listedFor(kind) : this.themes.listed();
  });
  protected readonly query = signal('');
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = [...this.list()].sort((a, b) => a.name.localeCompare(b.name));
    return q ? all.filter((t) => t.name.toLowerCase().includes(q)) : all;
  });

  protected readonly paged = pagedList(this.filtered);

  constructor() {
    void this.themes.refreshListed();
  }

  protected search(text: string): void {
    this.query.set(text);
    this.paged.reset();
  }
}
