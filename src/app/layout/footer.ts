import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../shared/icon';
import { Logo } from '../shared/logo';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Logo, Icon],
  host: { class: 'block' },
  template: `
    <footer class="mt-20 bg-ink-900 text-zinc-300">
      <div class="container-page grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div class="lg:col-span-2">
          <app-logo [inverted]="true" />
          <p class="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
            Нови и внимателно проверени употребявани сетове и минифигурки. Доставка с Еконт и Спиди, плащане при
            получаване.
          </p>
          <div class="mt-6 grid max-w-md grid-cols-3 gap-3 text-xs">
            <div class="rounded-xl bg-ink-800 p-3"><app-icon name="cash" class="mb-2 text-stud-400" /> Наложен платеж</div>
            <div class="rounded-xl bg-ink-800 p-3"><app-icon name="eye" class="mb-2 text-stud-400" /> Преглед преди плащане</div>
            <div class="rounded-xl bg-ink-800 p-3"><app-icon name="refresh" class="mb-2 text-stud-400" /> 14 дни за връщане</div>
          </div>
        </div>

        <div>
          <h3 class="font-display text-base font-bold text-white">Магазин</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a routerLink="/catalog" [queryParams]="{ condition: 'new' }" class="hover:text-white">Нови сетове</a></li>
            <li><a routerLink="/catalog" [queryParams]="{ condition: 'used' }" class="hover:text-white">Употребявани</a></li>
            <li><a routerLink="/catalog" [queryParams]="{ type: 'minifig' }" class="hover:text-white">Минифигурки</a></li>
            <li><a routerLink="/catalog" [queryParams]="{ type: 'part' }" class="hover:text-white">Части</a></li>
            <li><a routerLink="/account" class="hover:text-white">Моят профил</a></li>
          </ul>
        </div>

        <div>
          <h3 class="font-display text-base font-bold text-white">Информация</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a routerLink="/info/delivery" class="hover:text-white">Доставка и плащане</a></li>
            <li><a routerLink="/info/returns" class="hover:text-white">Връщане и рекламации</a></li>
            <li><a routerLink="/info/terms" class="hover:text-white">Общи условия</a></li>
            <li><a routerLink="/info/privacy" class="hover:text-white">Политика за поверителност</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-white/10">
        <p class="container-page py-6 text-xs leading-relaxed text-zinc-500">
          LEGO®, логото LEGO, минифигурката и DUPLO® са търговски марки на LEGO Group, която не спонсорира и не одобрява
          този сайт. Каталожни данни: Rebrickable.
        </p>
      </div>
    </footer>
  `,
})
export class Footer {}
