import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../shared/icon';
import { ThemesStore } from '../stores/themes.store';

/** All top-level themes that currently have products for sale. */
@Component({
  selector: 'app-themes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <div class="container-page pt-8">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Всички теми</h1>
          <p class="mt-1 text-sm text-zinc-500">{{ themes.listed().length }} теми с налични продукти</p>
        </div>
        <div class="relative w-full sm:w-72">
          <app-icon name="search" [size]="18" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            class="input rounded-full pl-10"
            placeholder="Търси тема…"
            aria-label="Търси тема"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        @for (theme of filtered(); track theme.theme_id) {
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
        } @empty {
          <p class="col-span-full py-16 text-center text-sm text-zinc-500">
            @if (query()) { Няма тема „{{ query() }}“. } @else { Все още няма продукти. }
          </p>
        }
      </div>
    </div>
  `,
})
export class Themes {
  protected readonly themes = inject(ThemesStore);
  protected readonly query = signal('');
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = [...this.themes.listed()].sort((a, b) => a.name.localeCompare(b.name));
    return q ? all.filter((t) => t.name.toLowerCase().includes(q)) : all;
  });

  constructor() {
    void this.themes.refreshListed();
  }
}
