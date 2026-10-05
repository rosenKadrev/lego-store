import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../shared/icon';
import { AuthStore } from '../stores/auth.store';

type OrderState = { total?: number; email?: string; phone?: string; pickup?: boolean };

@Component({
  selector: 'app-order-success',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, Icon],
  template: `
    <div class="container-page max-w-2xl pt-12 text-center">
      <div class="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <app-icon name="check" [size]="40" [stroke]="2.5" />
      </div>
      <h1 class="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Благодарим за поръчката!</h1>
      <p class="mt-3 text-zinc-600">
        Номер на поръчката: <b class="text-ink-900">{{ number() }}</b>
        @if (state.total != null) {
          <br />Сума за плащане {{ state.pickup ? 'при взимане' : 'при доставка' }}: <b class="text-ink-900">{{ state.total | currency }}</b>
        }
      </p>

      <ol class="mt-10 space-y-4 rounded-3xl bg-zinc-50 p-6 text-left text-sm sm:p-8">
        <li class="flex gap-4">
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 font-bold text-white">1</span>
          <span>Ще се свържем с вас{{ state.phone ? ' на ' + state.phone : '' }}, за да потвърдим поръчката.</span>
        </li>
        <li class="flex gap-4">
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 font-bold text-white">2</span>
          @if (state.pickup) {
            <span>Подготвяме поръчката и ви се обаждаме, когато е готова за взимане.</span>
          } @else {
            <span>Изпращаме пратката и ви пращаме номер за проследяване{{ state.email ? ' на ' + state.email : '' }}.</span>
          }
        </li>
        <li class="flex gap-4">
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 font-bold text-white">3</span>
          <span>{{ state.pickup ? 'Идвате, преглеждате поръчката и плащате на място.' : 'Преглеждате пратката и плащате на куриера.' }}</span>
        </li>
      </ol>

      <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        @if (auth.isLoggedIn()) {
          <a routerLink="/account" class="btn-outline">Моите поръчки</a>
        }
        <a routerLink="/catalog" class="btn-primary">Продължи пазаруването</a>
      </div>
    </div>
  `,
})
export class OrderSuccess {
  protected readonly auth = inject(AuthStore);
  readonly number = input.required<string>();
  protected readonly state: OrderState = inject(Router).currentNavigation()?.extras.state ?? history.state ?? {};
}
