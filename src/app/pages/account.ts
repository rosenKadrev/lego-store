import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { displayItemNum, isMagazineNum, Order, OrderItem, slugify } from '../core/models';
import { Supabase } from '../core/supabase';
import { Icon } from '../shared/icon';
import { OrderStatusBadge } from '../shared/order-status-badge';
import { AuthStore } from '../stores/auth.store';
import { ToastStore } from '../stores/toast.store';

type OrderWithItems = Order & { order_items: OrderItem[] };

/** Orders per "Покажи още" */
const MY_ORDERS_PAGE = 10;

const MyOrdersStore = signalStore(
  withState({
    orders: [] as OrderWithItems[],
    total: 0,
    loading: true,
    loadingMore: false,
    imageByListing: {} as Record<number, string | null>,
  }),
  withMethods((store, supabase = inject(Supabase)) => {
    let userId: string | undefined;

    /** The next MY_ORDERS_PAGE orders, newest first, with their pictures */
    async function fetchMore(): Promise<void> {
      if (!userId) return;
      const from = store.orders().length;
      // Filter by user explicitly: RLS lets the admin read every order
      const { data, count } = await supabase.client
        .from('orders')
        .select('*, order_items(*)', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + MY_ORDERS_PAGE - 1);
      const orders = data ?? [];
      // Pictures: own photo first, else the catalog image (as in the shop)
      const listingIds = [...new Set(orders.flatMap((o) => o.order_items.map((i) => i.listing_id)))];
      const imageByListing = { ...store.imageByListing() };
      if (listingIds.length) {
        const { data: listings } = await supabase.client.from('catalog_listings').select('id, cover_path, catalog_img_url').in('id', listingIds);
        for (const l of listings ?? []) imageByListing[l.id!] = supabase.coverUrl(l);
      }
      patchState(store, { orders: [...store.orders(), ...orders], total: count ?? 0, imageByListing });
    }

    return {
      async load(id: string | undefined): Promise<void> {
        userId = id;
        patchState(store, { orders: [], total: 0, loading: true });
        await fetchMore();
        patchState(store, { loading: false });
      },
      async loadMore(): Promise<void> {
        patchState(store, { loadingMore: true });
        await fetchMore();
        patchState(store, { loadingMore: false });
      },
    };
  }),
);

@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, Icon, OrderStatusBadge],
  providers: [MyOrdersStore],
  template: `
    <div class="container-page pt-8">
      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Здравей, {{ auth.displayName() }}!</h1>
      <p class="mt-1 text-sm text-fg-muted">{{ auth.user()?.email }}</p>

      <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 class="text-xl font-bold">Моите поръчки</h2>
          @if (orders.loading()) {
            <div class="mt-4 h-32 animate-pulse rounded-2xl bg-surface-3"></div>
          } @else {
            <ul class="mt-4 space-y-3">
              @for (order of orders.orders(); track order.id) {
                @let open = expanded().has(order.id);
                @let count = itemCount(order);
                <!-- Accordion: an order of a hundred loose parts would otherwise fill the page -->
                <li class="card overflow-hidden">
                  <button
                    type="button"
                    class="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-5 text-left hover:bg-surface-2"
                    [attr.aria-expanded]="open"
                    (click)="toggle(order.id)"
                  >
                    <span class="min-w-0 flex-1">
                      <b class="block">{{ order.number }}</b>
                      <span class="text-xs text-fg-muted">{{ order.created_at | date: 'd MMMM y, HH:mm' }} · {{ count }} {{ count === 1 ? 'продукт' : 'продукта' }}</span>
                    </span>
                    @if (!open) {
                      <!-- Phones: the first pictures on a row of their own -->
                      <span class="order-1 flex basis-full items-center gap-1.5 sm:order-none sm:basis-auto">
                        @for (item of order.order_items.slice(0, 4); track item.id) {
                          <span class="size-9 overflow-hidden rounded-md bg-well">
                            @if (orders.imageByListing()[item.listing_id]; as src) {
                              <img [src]="src" alt="" class="size-full object-contain p-0.5 mix-blend-multiply" loading="lazy" />
                            }
                          </span>
                        }
                        @if (order.order_items.length > 4) {
                          <span class="text-xs font-semibold text-fg-muted">+{{ order.order_items.length - 4 }}</span>
                        }
                      </span>
                    }
                    <app-order-status-badge [status]="order.status" />
                    <b class="whitespace-nowrap">{{ order.total | currency }}</b>
                    <app-icon name="chevronDown" [size]="18" class="transition" [class.rotate-180]="open" />
                  </button>
                  @if (open) {
                    <div class="border-t border-line-soft px-5 pt-4 pb-5">
                      <!-- Orders of many parts: the list scrolls (about 7 rows) instead of stretching the page -->
                      <ul class="max-h-[26rem] space-y-2 overflow-y-auto overscroll-contain pr-1 text-sm text-fg-2 [scrollbar-width:thin]">
                        @for (item of order.order_items; track item.id) {
                          <li class="flex items-center justify-between gap-3">
                            <a [routerLink]="productLink(item)" class="size-12 shrink-0 overflow-hidden rounded-lg bg-well">
                              @if (orders.imageByListing()[item.listing_id]; as src) {
                                <img [src]="src" alt="" class="size-full object-contain p-0.5 mix-blend-multiply" loading="lazy" />
                              }
                            </a>
                            <span class="min-w-0 flex-1"
                              >{{ item.quantity }} × <span class="text-fg-muted">LEGO{{ isMagazineNum(item.item_num) ? '' : ' ' + itemNum(item.item_num) }}</span>
                              <a [routerLink]="productLink(item)" class="ml-1 hover:text-accent hover:underline">{{ item.name }}</a></span
                            >
                            <span class="whitespace-nowrap">{{ item.unit_price * item.quantity | currency }}</span>
                          </li>
                        }
                      </ul>
                      <div class="mt-3 flex flex-wrap justify-between gap-2 border-t border-line-soft pt-3 text-sm">
                        <span class="text-fg-muted">
                          @if (order.tracking_number) { Товарителница: <b class="text-fg">{{ order.tracking_number }}</b> }
                        </span>
                        <b>
                          Общо {{ order.total | currency }}
                          @if (order.delivery_type !== 'pickup') {
                            <span class="font-normal text-fg-muted"
                              >+ доставка {{ order.shipping_price == null ? '(уточнява се)' : (order.shipping_price | currency) + ', плаща се на куриера' }}</span
                            >
                          }
                        </b>
                      </div>
                    </div>
                  }
                </li>
              } @empty {
                <li class="rounded-2xl bg-surface-2 p-8 text-center text-sm text-fg-muted">Все още нямате поръчки.</li>
              }
            </ul>
            @if (orders.orders().length < orders.total()) {
              <div class="mt-4 text-center">
                <button type="button" class="btn-outline" [disabled]="orders.loadingMore()" (click)="orders.loadMore()">
                  {{ orders.loadingMore() ? 'Зареждане…' : 'Покажи още (' + (orders.total() - orders.orders().length) + ')' }}
                </button>
              </div>
            }
          }
        </section>

        <section class="h-fit rounded-3xl bg-surface-2 p-6">
          <h2 class="text-lg font-bold">Лични данни</h2>
          <form [formGroup]="form" (ngSubmit)="save()" class="mt-4 space-y-4">
            <div>
              <label class="label" for="fullName">Име и фамилия</label>
              <input id="fullName" class="input" formControlName="full_name" />
            </div>
            <div>
              <label class="label" for="phone">Телефон</label>
              <input id="phone" class="input" type="tel" formControlName="phone" />
            </div>
            <button type="submit" class="btn-dark w-full" [disabled]="form.pristine">Запази</button>
          </form>
          <div class="mt-6 border-t border-line pt-5">
            @if (passwordChanged) {
              <p class="mb-3 text-sm text-emerald-700 dark:text-emerald-400">Паролата е сменена успешно.</p>
            }
            <a routerLink="/reset-password" class="btn-outline w-full">Смени паролата</a>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class Account implements OnInit {
  protected readonly auth = inject(AuthStore);
  protected readonly orders = inject(MyOrdersStore);
  protected readonly itemNum = displayItemNum;
  protected readonly isMagazineNum = isMagazineNum;

  protected readonly form = inject(FormBuilder).nonNullable.group({ full_name: [''], phone: [''] });
  private readonly toast = inject(ToastStore);
  protected readonly passwordChanged = !!inject(Router).currentNavigation()?.extras.state?.['passwordChanged'];

  constructor() {
    effect(() => {
      const p = this.auth.profile();
      if (p && this.form.pristine) this.form.reset({ full_name: p.full_name ?? '', phone: p.phone ?? '' });
    });
  }

  ngOnInit(): void {
    void this.orders.load(this.auth.user()?.id);
  }

  /** Open orders (several may be open at once) */
  protected readonly expanded = signal(new Set<number>());

  protected toggle(id: number): void {
    const next = new Set(this.expanded());
    if (!next.delete(id)) next.add(id);
    this.expanded.set(next);
  }

  protected itemCount(order: OrderWithItems): number {
    return order.order_items.reduce((sum, i) => sum + i.quantity, 0);
  }

  protected productLink(item: OrderItem): string[] {
    return ['/p', `${item.listing_id}-${slugify(item.name)}`];
  }

  protected async save(): Promise<void> {
    const error = await this.auth.updateProfile(this.form.getRawValue());
    if (error) {
      this.toast.error(error);
      return;
    }
    this.toast.success('Данните са запазени.');
    this.form.markAsPristine();
  }
}
