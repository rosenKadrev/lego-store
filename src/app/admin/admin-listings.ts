import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CONDITION_LABEL, displayItemNum } from '../core/models';
import { Supabase } from '../core/supabase';
import { Icon } from '../shared/icon';
import { QuantityStepper } from '../shared/quantity-stepper';
import { AdminListingFilters, AdminListingsStore } from './admin-listings.store';

@Component({
  selector: 'app-admin-listings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, CurrencyPipe, Icon, QuantityStepper],
  providers: [AdminListingsStore],
  template: `
    @let f = store.filters();
    <div class="flex flex-col gap-3 md:flex-row">
      <input
        type="search"
        class="input md:max-w-xs"
        placeholder="Търси по име или номер"
        [ngModel]="f.q"
        (ngModelChange)="search($event)"
      />
      <div class="grid gap-2 sm:grid-cols-3 md:flex">
        <select class="input md:w-48" [ngModel]="f.condition" (ngModelChange)="store.setFilters({ condition: $event })">
          <option [ngValue]="null">Всички състояния</option>
          <option value="new">Нови</option>
          <option value="used">Употребявани</option>
        </select>
        <select class="input md:w-44" [ngModel]="f.type" (ngModelChange)="store.setFilters({ type: $event })">
          <option [ngValue]="null">Всички видове</option>
          <option value="set">Сетове</option>
          <option value="minifig">Минифигурки</option>
          <option value="part">Части</option>
          <option value="magazine">Списания</option>
        </select>
        <select class="input md:w-40" [ngModel]="f.status" (ngModelChange)="store.setFilters({ status: $event })">
          @for (s of statuses; track s.value) {
            <option [value]="s.value">{{ s.label }}</option>
          }
        </select>
      </div>
      <p class="self-center text-sm text-fg-muted md:ml-auto">{{ store.total() }} обяви</p>
    </div>

    @let selected = store.selected().length;
    <div class="mt-5 overflow-hidden rounded-2xl border border-line" [class.opacity-60]="store.loading() || store.bulkSaving()">
      <!-- Bulk actions: tick the page (or every listing matching the filters), then publish / hide at once -->
      <!-- min-h: as tall as with the buttons (38px + padding), so the bar does not jump when ticking -->
      <div class="flex min-h-[3.625rem] flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-2 px-3 py-2.5 sm:px-4">
        <label class="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            class="size-4 accent-brick-600"
            [checked]="pageSelected() === 'all'"
            [indeterminate]="pageSelected() === 'some'"
            [disabled]="!store.items().length"
            (change)="store.selectPage($any($event.target).checked)"
          />
          Цялата страница
        </label>
        @if (selected < store.total() && store.total() > store.items().length) {
          <button type="button" class="text-sm text-accent underline hover:no-underline" (click)="store.selectAllMatching()">
            Избери всички {{ store.total() }}
          </button>
        }
        @if (selected) {
          <span class="text-sm text-fg-muted">Избрани: <b class="text-fg">{{ selected }}</b></span>
          <div class="flex flex-wrap gap-2 sm:ml-auto">
            <button type="button" class="btn-primary px-4 py-2" [disabled]="store.bulkSaving()" (click)="store.setPublishedSelected(true)">
              <app-icon name="eye" [size]="16" /> Публикувай
            </button>
            <button type="button" class="btn-outline px-4 py-2" [disabled]="store.bulkSaving()" (click)="store.setPublishedSelected(false)">
              <app-icon name="eyeOff" [size]="16" /> Скрий
            </button>
            <button type="button" class="btn-ghost px-3 py-2" [disabled]="store.bulkSaving()" (click)="store.clearSelection()">Отказ</button>
          </div>
        }
      </div>
      <ul class="divide-y divide-line-soft">
        @for (l of store.items(); track l.id) {
          <!-- Phones: photo + name / price, stock and actions on a second row; sm+: one row -->
          <li class="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:flex-nowrap sm:p-4" [class.bg-accent-soft]="isSelected(l.id!)">
            <input
              type="checkbox"
              class="size-4 shrink-0 accent-brick-600"
              [checked]="isSelected(l.id!)"
              [attr.aria-label]="'Избери ' + l.name"
              (change)="store.toggleSelected(l.id!)"
            />
            <div class="size-14 shrink-0 overflow-hidden rounded-xl bg-well">
              @if (cover(l); as src) {
                <img [src]="src" alt="" class="size-full object-contain p-1 mix-blend-multiply" loading="lazy" />
              }
            </div>
            <div class="min-w-0 flex-1 basis-[calc(100%-6.5rem)] sm:basis-0">
              <a [routerLink]="['/admin/listings', l.id]" class="line-clamp-2 sm:line-clamp-1 font-semibold hover:text-accent">
                {{ l.name }}@if (l.color_name) { <span class="font-normal text-fg-muted">— {{ l.color_name }}</span> }
              </a>
              <p class="text-xs text-fg-muted">
                {{ itemNum(l.item_num) }} ·
                <span [class]="l.condition === 'new' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'">{{ conditionLabel[l.condition!] }}</span>
                @if (l.box_damaged) { · <span class="text-amber-700 dark:text-amber-400">ударена кутия</span> }
                @if (l.theme_name ?? l.part_category; as group) { · {{ group }} }
              </p>
            </div>
            <p class="font-bold sm:w-24 sm:text-right">{{ l.price | currency }}</p>
            @if (l.condition === 'new' || l.item_type === 'part' || l.item_type === 'magazine') {
              <app-quantity-stepper [value]="l.stock ?? 0" [max]="999" (valueChange)="store.setStock(l.id!, $event)" />
            } @else {
              <span class="chip w-[6.5rem] justify-center" [class]="l.stock ? 'bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300' : 'bg-surface-4 text-fg-3'">
                {{ l.stock ? 'Наличен' : 'Продаден' }}
              </span>
            }
            <button
              type="button"
              class="btn ml-auto size-10 p-0 sm:ml-0"
              [class]="l.is_published ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-400/10' : 'text-fg-faint hover:bg-surface-3'"
              [attr.aria-label]="l.is_published ? 'Скрий' : 'Публикувай'"
              [title]="l.is_published ? 'Публикувана — натисни, за да скриеш' : 'Чернова — натисни, за да публикуваш'"
              (click)="store.togglePublished(l)"
            >
              <app-icon [name]="l.is_published ? 'eye' : 'eyeOff'" />
            </button>
            <a [routerLink]="['/admin/listings', l.id]" class="btn-ghost size-10 p-0" aria-label="Редактирай">
              <app-icon name="edit" [size]="18" />
            </a>
          </li>
        } @empty {
          <li class="p-10 text-center text-sm text-fg-muted">
            @if (store.loading()) { Зареждане… } @else { Няма обяви. <a routerLink="/admin/listings/new" class="text-accent underline">Създай първата</a>. }
          </li>
        }
      </ul>
    </div>

    @if (pageCount() > 1) {
      <div class="mt-5 flex items-center justify-center gap-3 text-sm">
        <button type="button" class="btn-outline" [disabled]="store.page() <= 1" (click)="store.setPage(store.page() - 1)">Назад</button>
        <span>{{ store.page() }} / {{ pageCount() }}</span>
        <button type="button" class="btn-outline" [disabled]="store.page() >= pageCount()" (click)="store.setPage(store.page() + 1)">Напред</button>
      </div>
    }
  `,
})
export class AdminListings implements OnInit {
  protected readonly store = inject(AdminListingsStore);
  private readonly supabase = inject(Supabase);
  protected readonly conditionLabel = CONDITION_LABEL;
  protected readonly itemNum = displayItemNum;
  protected readonly statuses: { value: AdminListingFilters['status']; label: string }[] = [
    { value: 'all', label: 'Всички' },
    { value: 'published', label: 'Публикувани' },
    { value: 'draft', label: 'Чернови' },
    { value: 'sold_out', label: 'Изчерпани' },
  ];
  private readonly selectedIds = computed(() => new Set(this.store.selected()));
  /** The "whole page" checkbox: ticked, half-ticked or empty */
  protected readonly pageSelected = computed(() => {
    const items = this.store.items();
    const ticked = items.filter((i) => this.selectedIds().has(i.id!)).length;
    return ticked && ticked === items.length ? 'all' : ticked ? 'some' : 'none';
  });
  protected readonly pageCount = computed(() => Math.ceil(this.store.total() / this.store.pageSize()));
  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    void this.store.load();
  }

  protected cover(l: Parameters<Supabase['coverUrl']>[0]): string | null {
    return this.supabase.coverUrl(l);
  }

  protected isSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  protected search(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setFilters({ q }), 300);
  }
}
