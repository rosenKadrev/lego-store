import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { displayItemNum, isMagazineNum, Order, OrderItem, slugify } from '../core/models';
import { Supabase } from '../core/supabase';
import { OrderStatusBadge } from '../shared/order-status-badge';
import { AuthStore } from '../stores/auth.store';
import { ToastStore } from '../stores/toast.store';

type OrderWithItems = Order & { order_items: OrderItem[] };

const MyOrdersStore = signalStore(
  withState({ orders: [] as OrderWithItems[], loading: true, imageByListing: {} as Record<number, string | null> }),
  withMethods((store, supabase = inject(Supabase)) => ({
    async load(userId: string | undefined): Promise<void> {
      if (!userId) return patchState(store, { loading: false });
      // Filter by user explicitly: RLS lets the admin read every order
      const { data } = await supabase.client
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const orders = data ?? [];
      // Pictures: own photo first, else the catalog image (as in the shop)
      const listingIds = [...new Set(orders.flatMap((o) => o.order_items.map((i) => i.listing_id)))];
      const imageByListing: Record<number, string | null> = {};
      if (listingIds.length) {
        const { data: listings } = await supabase.client.from('catalog_listings').select('id, cover_path, catalog_img_url').in('id', listingIds);
        for (const l of listings ?? []) imageByListing[l.id!] = supabase.coverUrl(l);
      }
      patchState(store, { orders, imageByListing, loading: false });
    },
  })),
);

@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, OrderStatusBadge],
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
                <li class="card p-5">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="font-bold">{{ order.number }}</p>
                      <p class="text-xs text-fg-muted">{{ order.created_at | date: 'd MMMM y, HH:mm' }}</p>
                    </div>
                    <app-order-status-badge [status]="order.status" />
                  </div>
                  <ul class="mt-3 space-y-2 text-sm text-fg-2">
                    @for (item of order.order_items; track item.id) {
                      <li class="flex items-center justify-between gap-3">
                        <a [routerLink]="productLink(item)" class="size-12 shrink-0 overflow-hidden rounded-lg bg-well">
                          @if (orders.imageByListing()[item.listing_id]; as src) {
                            <img [src]="src" alt="" class="size-full object-contain p-0.5 mix-blend-multiply" loading="lazy" />
                          }
                        </a>
                        <span class="min-w-0 flex-1"
                          >{{ item.quantity }} × <span class="text-fg-muted">LEGO{{ isMagazineNum(item.item_num) ? '' : ' ' + itemNum(item.item_num) }}</span>
                          <a [routerLink]="productLink(item)" class="hover:text-accent hover:underline">{{ item.name }}</a></span
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
                      @if (order.shipping_price == null && order.delivery_type !== 'pickup') {
                        <span class="font-normal text-fg-muted">+ доставка (уточнява се)</span>
                      }
                    </b>
                  </div>
                </li>
              } @empty {
                <li class="rounded-2xl bg-surface-2 p-8 text-center text-sm text-fg-muted">Все още нямате поръчки.</li>
              }
            </ul>
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
