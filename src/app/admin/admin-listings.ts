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
      <div class="grid grid-cols-3 gap-2 md:flex">
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
        </select>
        <select class="input md:w-40" [ngModel]="f.status" (ngModelChange)="store.setFilters({ status: $event })">
          @for (s of statuses; track s.value) {
            <option [value]="s.value">{{ s.label }}</option>
          }
        </select>
      </div>
      <p class="self-center text-sm text-zinc-500 md:ml-auto">{{ store.total() }} обяви</p>
    </div>

    <div class="mt-5 overflow-hidden rounded-2xl border border-zinc-200" [class.opacity-60]="store.loading()">
      <ul class="divide-y divide-zinc-100">
        @for (l of store.items(); track l.id) {
          <li class="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:flex-nowrap sm:p-4">
            <div class="size-14 shrink-0 overflow-hidden rounded-xl bg-zinc-50">
              @if (cover(l); as src) {
                <img [src]="src" alt="" class="size-full object-contain p-1 mix-blend-multiply" loading="lazy" />
              }
            </div>
            <div class="min-w-0 flex-1">
              <a [routerLink]="['/admin/listings', l.id]" class="line-clamp-1 font-semibold hover:text-brick-600">
                {{ l.name }}@if (l.color_name) { <span class="font-normal text-zinc-500">— {{ l.color_name }}</span> }
              </a>
              <p class="text-xs text-zinc-500">
                {{ itemNum(l.item_num) }} ·
                <span [class]="l.condition === 'new' ? 'text-emerald-700' : 'text-amber-700'">{{ conditionLabel[l.condition!] }}</span>
                @if (l.box_damaged) { · <span class="text-amber-700">ударена кутия</span> }
                @if (l.theme_name ?? l.part_category; as group) { · {{ group }} }
              </p>
            </div>
            <p class="w-24 text-right font-bold">{{ l.price | currency }}</p>
            @if (l.condition === 'new' || l.item_type === 'part') {
              <app-quantity-stepper [value]="l.stock ?? 0" [max]="999" (valueChange)="store.setStock(l.id!, $event)" />
            } @else {
              <span class="chip w-[6.5rem] justify-center" [class]="l.stock ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'">
                {{ l.stock ? 'Наличен' : 'Продаден' }}
              </span>
            }
            <button
              type="button"
              class="btn size-10 p-0"
              [class]="l.is_published ? 'text-emerald-700 hover:bg-emerald-50' : 'text-zinc-400 hover:bg-zinc-100'"
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
          <li class="p-10 text-center text-sm text-zinc-500">
            @if (store.loading()) { Зареждане… } @else { Няма обяви. <a routerLink="/admin/listings/new" class="text-brick-600 underline">Създай първата</a>. }
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
  protected readonly pageCount = computed(() => Math.ceil(this.store.total() / this.store.pageSize()));
  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    void this.store.load();
  }

  protected cover(l: Parameters<Supabase['coverUrl']>[0]): string | null {
    return this.supabase.coverUrl(l);
  }

  protected search(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setFilters({ q }), 300);
  }
}
