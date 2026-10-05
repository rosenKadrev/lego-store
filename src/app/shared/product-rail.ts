import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogListing } from '../core/models';
import { Icon } from './icon';
import { ProductCard } from './product-card';

/** Horizontally scrolling row of products with snap points; arrows on desktop, swipe on mobile. */
@Component({
  selector: 'app-product-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCard, RouterLink, Icon],
  template: `
    <div class="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-extrabold tracking-tight sm:text-3xl">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="mt-1 text-sm text-zinc-500">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex items-center gap-2">
        <a [routerLink]="moreLink()" [queryParams]="moreParams()" class="btn-ghost hidden sm:inline-flex">
          Виж всички <app-icon name="arrowRight" [size]="16" />
        </a>
        <button type="button" class="btn-outline hidden size-10 p-0 md:inline-flex" aria-label="Назад" (click)="scroll(-1)">
          <app-icon name="chevronLeft" />
        </button>
        <button type="button" class="btn-outline hidden size-10 p-0 md:inline-flex" aria-label="Напред" (click)="scroll(1)">
          <app-icon name="chevronRight" />
        </button>
      </div>
    </div>

    @if (loading()) {
      <div class="flex gap-4 overflow-hidden">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <div class="aspect-[3/4] w-[46%] shrink-0 animate-pulse rounded-2xl bg-zinc-100 sm:w-[31%] lg:w-[23%] xl:w-[19%]"></div>
        }
      </div>
    } @else {
      <div
        #track
        class="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        @for (item of items(); track item.id) {
          <app-product-card [listing]="item" class="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%] xl:w-[19%]" />
        } @empty {
          <p class="py-10 text-sm text-zinc-500">Скоро ще има продукти тук.</p>
        }
      </div>
    }
    <a [routerLink]="moreLink()" [queryParams]="moreParams()" class="btn-outline mt-4 w-full sm:hidden">Виж всички</a>
  `,
})
export class ProductRail {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly items = input.required<CatalogListing[]>();
  readonly loading = input(false);
  readonly moreLink = input<string>('/catalog');
  readonly moreParams = input<Record<string, string>>({});

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  protected scroll(direction: 1 | -1): void {
    const el = this.track()?.nativeElement;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }
}
