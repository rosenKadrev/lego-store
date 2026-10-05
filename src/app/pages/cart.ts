import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONDITION_LABEL, displayItemNum } from '../core/models';
import { Icon } from '../shared/icon';
import { QuantityStepper } from '../shared/quantity-stepper';
import { CartStore } from '../stores/cart.store';

@Component({
  selector: 'app-cart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, Icon, QuantityStepper],
  template: `
    <div class="container-page pt-8">
      <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Количка</h1>

      @for (note of notes(); track note) {
        <p class="mt-4 rounded-xl bg-stud-300/40 p-3 text-sm">{{ note }}</p>
      }

      @if (cart.items().length) {
        <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <ul class="divide-y divide-zinc-100 rounded-3xl border border-zinc-200 px-4 sm:px-6">
            @for (item of cart.items(); track item.listingId) {
              <li class="flex gap-4 py-5">
                <div class="size-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-50 sm:size-28">
                  @if (item.imageUrl) {
                    <img [src]="item.imageUrl" [alt]="item.name" class="size-full object-contain p-2 mix-blend-multiply" />
                  }
                </div>
                <div class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold">{{ item.name }}</p>
                    <p class="text-sm text-zinc-500">{{ itemNum(item.itemNum) }} · {{ conditionLabel[item.condition] }}</p>
                    <p class="text-sm text-zinc-500 sm:hidden">{{ item.price | currency }} / бр.</p>
                  </div>
                  <div class="flex items-center justify-between gap-6 pt-2 sm:pt-0">
                    <app-quantity-stepper [value]="item.quantity" [max]="item.maxStock" (valueChange)="cart.setQuantity(item.listingId, $event)" />
                    <p class="w-24 text-right font-bold">{{ item.price * item.quantity | currency }}</p>
                  </div>
                </div>
                <button type="button" class="self-start text-zinc-400 hover:text-brick-600 sm:self-center" aria-label="Премахни" (click)="cart.remove(item.listingId)">
                  <app-icon name="trash" [size]="20" />
                </button>
              </li>
            }
          </ul>

          <aside class="h-fit space-y-4 rounded-3xl bg-zinc-50 p-6 lg:sticky lg:top-32">
            <h2 class="text-lg font-bold">Обобщение</h2>
            <div class="flex justify-between text-sm"><span>Продукти ({{ cart.count() }})</span><b>{{ cart.subtotal() | currency }}</b></div>
            <div class="flex justify-between text-sm">
              <span>Доставка</span>
              <span class="text-zinc-500">уточнява се</span>
            </div>
            <p class="rounded-xl bg-white p-3 text-xs text-zinc-600">
              Служител ще се свърже с вас, за да уточни цената на доставката. Можете да изберете и безплатно лично взимане.
            </p>
            <a routerLink="/checkout" class="btn-primary w-full py-3.5 text-base">Продължи към поръчка</a>
            <a routerLink="/catalog" class="btn-ghost w-full">Продължи пазаруването</a>
          </aside>
        </div>
      } @else {
        <div class="mt-10 flex flex-col items-center gap-4 rounded-3xl bg-zinc-50 py-20 text-center">
          <app-icon name="cart" [size]="48" class="text-zinc-300" />
          <p class="text-lg font-semibold">Количката е празна</p>
          <a routerLink="/catalog" class="btn-primary">Разгледай продуктите</a>
        </div>
      }
    </div>
  `,
})
export class Cart implements OnInit {
  protected readonly cart = inject(CartStore);
  protected readonly conditionLabel = CONDITION_LABEL;
  protected readonly itemNum = displayItemNum;
  protected readonly notes = signal<string[]>([]);

  async ngOnInit(): Promise<void> {
    this.notes.set(await this.cart.refresh());
  }
}
