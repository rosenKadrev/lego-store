import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Order, OrderItem } from '../core/models';
import { Supabase } from '../core/supabase';
import { OrderStatusBadge } from '../shared/order-status-badge';
import { AuthStore } from '../stores/auth.store';

type OrderWithItems = Order & { order_items: OrderItem[] };

const MyOrdersStore = signalStore(
  withState({ orders: [] as OrderWithItems[], loading: true }),
  withMethods((store, supabase = inject(Supabase)) => ({
    async load(): Promise<void> {
      const { data } = await supabase.client
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      patchState(store, { orders: data ?? [], loading: false });
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
      <p class="mt-1 text-sm text-zinc-500">{{ auth.user()?.email }}</p>

      <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 class="text-xl font-bold">Моите поръчки</h2>
          @if (orders.loading()) {
            <div class="mt-4 h-32 animate-pulse rounded-2xl bg-zinc-100"></div>
          } @else {
            <ul class="mt-4 space-y-3">
              @for (order of orders.orders(); track order.id) {
                <li class="card p-5">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p class="font-bold">{{ order.number }}</p>
                      <p class="text-xs text-zinc-500">{{ order.created_at | date: 'd MMMM y, HH:mm' }}</p>
                    </div>
                    <app-order-status-badge [status]="order.status" />
                  </div>
                  <ul class="mt-3 space-y-1 text-sm text-zinc-700">
                    @for (item of order.order_items; track item.id) {
                      <li class="flex justify-between gap-4">
                        <span class="truncate">{{ item.quantity }} × {{ item.name }}</span>
                        <span>{{ item.unit_price * item.quantity | currency }}</span>
                      </li>
                    }
                  </ul>
                  <div class="mt-3 flex flex-wrap justify-between gap-2 border-t border-zinc-100 pt-3 text-sm">
                    <span class="text-zinc-500">
                      @if (order.tracking_number) { Товарителница: <b class="text-ink-900">{{ order.tracking_number }}</b> }
                    </span>
                    <b>Общо {{ order.total | currency }}</b>
                  </div>
                </li>
              } @empty {
                <li class="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">Все още нямате поръчки.</li>
              }
            </ul>
          }
        </section>

        <section class="h-fit rounded-3xl bg-zinc-50 p-6">
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
            @if (message()) {
              <p class="text-sm" [class]="messageIsError() ? 'text-brick-700' : 'text-emerald-700'">{{ message() }}</p>
            }
            <button type="submit" class="btn-dark w-full" [disabled]="form.pristine">Запази</button>
          </form>
          <div class="mt-6 border-t border-zinc-200 pt-5">
            @if (passwordChanged) {
              <p class="mb-3 text-sm text-emerald-700">Паролата е сменена успешно.</p>
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

  protected readonly form = inject(FormBuilder).nonNullable.group({ full_name: [''], phone: [''] });
  protected readonly message = signal<string | null>(null);
  protected readonly messageIsError = signal(false);
  protected readonly passwordChanged = !!inject(Router).currentNavigation()?.extras.state?.['passwordChanged'];

  constructor() {
    effect(() => {
      const p = this.auth.profile();
      if (p && this.form.pristine) this.form.reset({ full_name: p.full_name ?? '', phone: p.phone ?? '' });
    });
  }

  ngOnInit(): void {
    void this.orders.load();
  }

  protected async save(): Promise<void> {
    const error = await this.auth.updateProfile(this.form.getRawValue());
    this.messageIsError.set(!!error);
    this.message.set(error ?? 'Данните са запазени.');
    if (!error) this.form.markAsPristine();
  }
}
