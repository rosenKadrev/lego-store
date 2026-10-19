import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../shared/icon';
import { Pager, pagedList } from '../shared/pager';
import { PartFiltersStore } from '../stores/part-filters.store';

/** All part categories that currently have parts for sale (like the themes page, for parts). */
@Component({
  selector: 'app-part-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, Pager],
  template: `
    <div class="container-page pt-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Категории части</h1>
          <p class="mt-1 text-sm text-fg-muted">
            {{ categories().length }} категории с налични части ·
            <a routerLink="/catalog" [queryParams]="{ type: 'part' }" class="font-semibold text-accent hover:underline">Всички части</a>
          </p>
        </div>
        <div class="relative w-full sm:w-72">
          <app-icon name="search" [size]="18" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-faint" />
          <input
            type="search"
            class="input rounded-full pl-10"
            placeholder="Търси категория…"
            aria-label="Търси категория"
            [value]="query()"
            (input)="search($any($event.target).value)"
          />
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        @for (category of paged.items(); track category.id) {
          <a
            routerLink="/catalog"
            [queryParams]="{ type: 'part', category: category.id }"
            class="group flex flex-col items-center gap-2 rounded-2xl border border-line p-4 text-center transition hover:border-brick-600 hover:shadow-lg"
          >
            <span class="grid aspect-square w-full place-items-center overflow-hidden rounded-xl dark:bg-well">
              @if (category.sample_img_url) {
                <img [src]="category.sample_img_url" alt="" loading="lazy" class="size-full object-contain mix-blend-multiply transition group-hover:scale-105" />
              }
            </span>
            <span class="text-sm font-bold">{{ category.name }}</span>
            <span class="text-xs text-fg-muted">{{ category.listing_count }} продукта</span>
          </a>
        } @empty {
          <p class="col-span-full py-16 text-center text-sm text-fg-muted">
            @if (query()) { Няма категория „{{ query() }}“. } @else if (partFilters.loaded()) { Все още няма части. }
          </p>
        }
      </div>

      <app-pager [page]="paged.page()" [pageCount]="paged.pageCount()" (pageChange)="paged.goTo($event)" />
    </div>
  `,
})
export class PartCategories {
  protected readonly partFilters = inject(PartFiltersStore);
  protected readonly categories = computed(() => this.partFilters.categories());
  protected readonly query = signal('');
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = [...this.categories()].sort((a, b) => a.name.localeCompare(b.name));
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  });

  protected readonly paged = pagedList(this.filtered);

  constructor() {
    void this.partFilters.load(true);
  }

  protected search(text: string): void {
    this.query.set(text);
    this.paged.reset();
  }
}
