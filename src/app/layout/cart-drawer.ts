import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CONDITION_LABEL, displayItemNum } from '../core/models';
import { Icon } from '../shared/icon';
import { QuantityStepper } from '../shared/quantity-stepper';
import { CartStore } from '../stores/cart.store';

@Component({
  selector: 'app-cart-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, Icon, QuantityStepper],
  template: `
    @if (cart.drawerOpen()) {
      <div class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Количка">
        <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" (click)="cart.closeDrawer()"></div>
        <aside class="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-2xl">
          <header class="flex h-16 items-center justify-between border-b border-line-soft px-5">
            <h2 class="text-lg font-bold">Количка ({{ cart.count() }})</h2>
            <button type="button" class="btn-ghost size-10 p-0" aria-label="Затвори" (click)="cart.closeDrawer()">
              <app-icon name="close" />
            </button>
          </header>

          @if (cart.items().length) {
            <ul class="flex-1 divide-y divide-line-soft overflow-y-auto px-5">
              @for (item of cart.items(); track item.listingId) {
                <li class="flex gap-4 py-4">
                  <div class="size-20 shrink-0 overflow-hidden rounded-xl bg-well">
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" [alt]="item.name" class="size-full object-contain p-1.5 mix-blend-multiply" />
                    }
                  </div>
                  <div class="flex min-w-0 flex-1 flex-col">
                    <p class="truncate text-sm font-semibold">{{ item.name }}</p>
                    <p class="text-xs text-fg-muted">{{ itemNum(item.itemNum) }} · {{ conditionLabel[item.condition] }}</p>
                    <div class="mt-auto flex items-center justify-between pt-2">
                      <app-quantity-stepper
                        [value]="item.quantity"
                        [max]="item.maxStock"
                        (valueChange)="cart.setQuantity(item.listingId, $event)"
                      />
                      <p class="text-sm font-bold">{{ item.price * item.quantity | currency }}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="self-start text-fg-faint hover:text-accent"
                    aria-label="Премахни"
                    (click)="cart.remove(item.listingId)"
                  >
                    <app-icon name="trash" [size]="18" />
                  </button>
                </li>
              }
            </ul>

            <footer class="space-y-3 border-t border-line-soft p-5">
              <div class="flex justify-between text-base">
                <span>Междинна сума</span>
                <b>{{ cart.subtotal() | currency }}</b>
              </div>
              <p class="flex items-center gap-1.5 text-xs text-fg-muted">
                <app-icon name="truck" [size]="14" />
                Цената на доставката се уточнява от служител. Лично взимане — безплатно.
              </p>
              <a routerLink="/checkout" class="btn-primary w-full py-3.5 text-base" (click)="cart.closeDrawer()">
                Към поръчката
              </a>
              <a routerLink="/cart" class="btn-outline w-full" (click)="cart.closeDrawer()">Преглед на количката</a>
            </footer>
          } @else {
            <div class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <div class="grid size-20 place-items-center rounded-full bg-surface-3 text-fg-faint">
                <app-icon name="cart" [size]="36" />
              </div>
              <p class="text-fg-muted">Количката е празна.</p>
              <a routerLink="/catalog" class="btn-primary" (click)="cart.closeDrawer()">Разгледай продуктите</a>
            </div>
          }
        </aside>
      </div>
    }
  `,
})
export class CartDrawer {
  protected readonly cart = inject(CartStore);
  protected readonly conditionLabel = CONDITION_LABEL;
  protected readonly itemNum = displayItemNum;

}
