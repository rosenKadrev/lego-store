import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../stores/cart.store';

type InfoPage = { title: string; paragraphs: string[] };

// Placeholder texts — replace with the final legal texts (check them with a lawyer/accountant).
const PAGES: Record<string, InfoPage> = {
  delivery: {
    title: 'Доставка и плащане',
    paragraphs: [
      'Доставяме с Еконт и Спиди до офис или до адрес в цялата страна. Обичайният срок е 2–5 работни дни след потвърждение на поръчката.',
      'Цената на доставката зависи от куриера и размера на пратката — наш служител ще ви я каже, когато потвърждаваме поръчката по телефона.',
      'Плащането е с наложен платеж — плащате на куриера при получаване. Можете да прегледате пратката преди да платите.',
    ],
  },
  returns: {
    title: 'Връщане и рекламации',
    paragraphs: [
      'Имате право да се откажете от покупката в срок от 14 дни от получаването, без да посочвате причина.',
      'Продуктът трябва да бъде върнат в състоянието, в което е получен. Разходите за обратна доставка са за сметка на купувача, освен ако продуктът не отговаря на описанието.',
    ],
  },
  terms: {
    title: 'Общи условия',
    paragraphs: ['Тук ще бъдат публикувани общите условия на магазина.'],
  },
  privacy: {
    title: 'Политика за поверителност',
    paragraphs: [
      'Използваме вашите данни (име, телефон, имейл, адрес) единствено за обработка и доставка на поръчките ви.',
      'Тук ще бъде публикувана пълната политика за защита на личните данни.',
    ],
  },
};

@Component({
  selector: 'app-info',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <article class="container-page max-w-3xl pt-10">
      @if (page(); as p) {
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ p.title }}</h1>
        <div class="mt-6 space-y-4 leading-relaxed text-zinc-700">
          @for (text of p.paragraphs; track $index) {
            <p>{{ text }}</p>
          }
        </div>
      } @else {
        <h1 class="text-3xl font-extrabold">Страницата не е намерена</h1>
        <a routerLink="/" class="btn-primary mt-6">Към началото</a>
      }
    </article>
  `,
})
export class Info {
  readonly page_ = input.required<string>({ alias: 'page' });
  private readonly cart = inject(CartStore);

  protected readonly page = computed<InfoPage | null>(() => {
    const page = PAGES[this.page_()];
    if (!page || this.page_() !== 'delivery') return page ?? null;
    // Pickup details come from the shop settings, same as at checkout
    const settings = this.cart.settings();
    if (settings && !settings.pickup_enabled) return page;
    const where = settings?.pickup_address ? ` на адрес ${settings.pickup_address}` : '';
    const hours = settings?.pickup_hours ? ` Работно време: ${settings.pickup_hours.charAt(0).toLowerCase()}${settings.pickup_hours.slice(1)}.` : '';
    return {
      ...page,
      paragraphs: [
        ...page.paragraphs,
        `Можете да вземете поръчката и лично${where} — безплатно, с плащане в брой на място.${hours} Ще ви се обадим, когато е готова.`,
      ],
    };
  });
}
