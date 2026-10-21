import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { filter } from 'rxjs';
import { Order } from '../core/models';
import { Supabase } from '../core/supabase';
import { Icon } from '../shared/icon';
import { OrderStatusBadge } from '../shared/order-status-badge';
import { AuthStore } from '../stores/auth.store';

type BellOrder = Pick<Order, 'id' | 'number' | 'customer_name' | 'total' | 'created_at' | 'status'>;
const COLUMNS = 'id, number, customer_name, total, created_at, status';

/**
 * Admin only: floating bell with the orders placed since the admin last looked (profiles.orders_seen_at,
 * so every device agrees). New orders arrive live over Supabase Realtime. Opening the bell or the
 * orders page marks them seen — on the other devices too, live. See migration 20261021120000_admin_order_bell.sql.
 */
@Component({
  selector: 'app-admin-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CurrencyPipe, DatePipe, OrderStatusBadge],
  host: { '(document:keydown.escape)': 'open.set(false)' },
  template: `
    @if (auth.isAdmin()) {
      @if (open()) {
        <button type="button" class="fixed inset-0 z-30 cursor-default" aria-label="Затвори" (click)="open.set(false)"></button>
        <div
          class="toast-in fixed bottom-20 left-4 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl sm:bottom-24 sm:left-6"
          role="dialog"
          aria-label="Нови поръчки"
        >
          <p class="border-b border-line px-4 py-3 font-bold">Нови поръчки</p>
          <ul class="max-h-80 divide-y divide-line-soft overflow-y-auto">
            @for (o of shown(); track o.id) {
              <li>
                <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-3" (click)="goTo(o.id)">
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold">{{ o.number }} · {{ o.customer_name }}</span>
                    <span class="block text-xs text-fg-muted">{{ o.created_at | date: 'd MMM, HH:mm' }} · {{ o.total | currency }}</span>
                  </span>
                  <app-order-status-badge [status]="o.status" />
                </button>
              </li>
            } @empty {
              <li class="px-4 py-6 text-center text-sm text-fg-muted">Няма нови поръчки.</li>
            }
          </ul>
          <button type="button" class="w-full border-t border-line px-4 py-3 text-sm font-semibold text-accent hover:bg-accent-soft" (click)="goTo(null)">
            Всички поръчки
          </button>
        </div>
      }
      <button
        type="button"
        class="fixed bottom-4 left-4 z-30 grid size-12 place-items-center rounded-full bg-inverse text-on-inverse shadow-xl shadow-ink-900/30 ring-1 ring-white/15 transition-colors hover:bg-inverse-hover sm:bottom-6 sm:left-6"
        [attr.aria-label]="unseen().length ? 'Нови поръчки: ' + unseen().length : 'Няма нови поръчки'"
        [attr.aria-expanded]="open()"
        [title]="unseen().length ? 'Нови поръчки: ' + unseen().length : 'Няма нови поръчки'"
        (click)="toggle()"
      >
        <app-icon name="bell" [size]="20" [stroke]="2.25" />
        @if (unseen().length) {
          <span class="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-brick-600 px-1 text-[11px] leading-none font-bold text-white ring-2 ring-page">
            {{ unseen().length > 9 ? '9+' : unseen().length }}
          </span>
        }
      </button>
    }
  `,
})
export class AdminBell {
  protected readonly auth = inject(AuthStore);
  private readonly db = inject(Supabase).client;
  private readonly router = inject(Router);

  protected readonly open = signal(false);
  /** Orders placed after the admin last looked, newest first */
  protected readonly unseen = signal<BellOrder[]>([]);
  /** What the open panel lists — stays put after the orders are marked seen */
  protected readonly shown = signal<BellOrder[]>([]);
  private channel: RealtimeChannel | null = null;
  private readonly onOrdersPage = signal(false);

  constructor() {
    effect(() => {
      const adminId = this.auth.isAdmin() ? this.auth.user()?.id : undefined;
      untracked(() => (adminId ? this.start(adminId) : this.stop()));
    });
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.onOrdersPage.set((e as NavigationEnd).urlAfterRedirects.startsWith('/admin/orders'));
      if (this.onOrdersPage()) void this.markSeen();
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected toggle(): void {
    if (this.open()) return this.open.set(false);
    this.shown.set(this.unseen());
    this.open.set(true);
    void this.markSeen();
  }

  protected goTo(orderId: number | null): void {
    this.open.set(false);
    void this.router.navigate(['/admin/orders'], { queryParams: orderId ? { order: orderId } : {} });
  }

  private async start(adminId: string): Promise<void> {
    this.stop();
    const seenAt = this.auth.profile()?.orders_seen_at;
    // Never looked yet: the orders still waiting for a call count as new
    let query = this.db.from('orders').select(COLUMNS);
    query = seenAt ? query.gt('created_at', seenAt) : query.eq('status', 'new');
    const { data } = await query.order('created_at', { ascending: false }).limit(50);
    this.unseen.set(data ?? []);
    if (this.onOrdersPage()) void this.markSeen();

    this.channel = this.db
      .channel(`admin-orders-${adminId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const order = payload.new as BellOrder;
        if (this.unseen().some((o) => o.id === order.id)) return;
        this.unseen.update((list) => [order, ...list]);
        if (this.open()) this.shown.update((list) => [order, ...list]);
        if (this.open() || this.onOrdersPage()) void this.markSeen();
      })
      // Seen on another device: drop what it saw
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${adminId}` }, (payload) => {
        const seenAt = (payload.new as { orders_seen_at: string | null }).orders_seen_at;
        if (seenAt) this.unseen.update((list) => list.filter((o) => Date.parse(o.created_at) > Date.parse(seenAt)));
      })
      .subscribe();
  }

  private stop(): void {
    if (this.channel) void this.db.removeChannel(this.channel);
    this.channel = null;
    this.unseen.set([]);
    this.open.set(false);
  }

  /** Seen up to the newest unseen order (server time, so a wrong device clock can't hide later orders) */
  private async markSeen(): Promise<void> {
    const newest = this.unseen()[0]?.created_at;
    const userId = this.auth.user()?.id;
    if (!newest || !userId) return;
    this.unseen.set([]);
    await this.db.from('profiles').update({ orders_seen_at: newest }).eq('id', userId);
  }
}
