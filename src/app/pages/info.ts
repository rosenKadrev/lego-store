import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHOP_EMAIL } from '../core/models';
import { CartStore } from '../stores/cart.store';

type InfoSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Paragraphs after the bullet list */
  after?: string[];
  link?: { label: string; href: string };
};
type InfoPage = { title: string; sections: InfoSection[] };

/** Filled in from the shop settings / constants when the page is shown; `address` reads after "на" */
type Contacts = { email: string; address: string };

// Placeholder texts — replace with the final legal texts (check them with a lawyer/accountant).
const PAGES: Record<string, (c: Contacts) => InfoPage> = {
  delivery: () => ({
    title: 'Доставка и плащане',
    sections: [
      {
        paragraphs: [
          'Доставяме с Еконт и Спиди до офис или до адрес в цялата страна. Обичайният срок е 2–5 работни дни след потвърждение на поръчката.',
          'Цената на доставката зависи от куриера и размера на пратката — наш служител ще ви я каже, когато потвърждаваме поръчката по телефона.',
          'Плащането е с наложен платеж — плащате на куриера при получаване. Можете да прегледате пратката преди да платите.',
        ],
      },
    ],
  }),
  returns: ({ email, address }) => ({
    title: 'Връщане и рекламации',
    sections: [
      {
        paragraphs: [
          'Ако купувате като потребител (физическо лице, за лични нужди), по Закона за защита на потребителите имате право да се откажете от покупката. По-долу е описано как става това и какво да направите, ако нещо с поръчката не е наред.',
        ],
      },
      {
        heading: 'Право на отказ в 14 дни',
        paragraphs: [
          'Можете да се откажете от поръчката, без да посочвате причина, в срок от 14 дни от деня, в който вие или посочено от вас лице (различно от куриера) получите стоката. Ако поръчката пристигне на няколко пратки, срокът тече от получаването на последната.',
        ],
      },
      {
        heading: 'Как да заявите отказ',
        paragraphs: [
          `Преди да изтекат 14-те дни ни изпратете ясно заявление, че се отказвате — на имейл ${email} или писмено на ${address}. В него посочете:`,
        ],
        bullets: [
          'номер на поръчката (например LS-1010);',
          'кои продукти връщате;',
          'банкова сметка (IBAN) и титуляр, по която да ви върнем сумата.',
        ],
        after: [
          'Можете да използвате стандартния формуляр за отказ от сайта на Комисията за защита на потребителите, но не е задължително — достатъчно е свободен текст.',
        ],
      },
      {
        heading: 'Връщане на продукта',
        bullets: [
          `Изпратете или донесете продукта на ${address} без неоправдано забавяне и не по-късно от 14 дни от деня, в който сте ни уведомили за отказа.`,
          'Разходите за обратната пратка са за ваша сметка. Пратки с наложен платеж не приемаме.',
          'Върнете продукта с всичко, което сте получили: части, минифигурки, книжки с инструкции, стикери и кутия (ако е имало).',
          'Отговаряте за намаляване на стойността, ако то се дължи на използване извън необходимото, за да прецените продукта — например ако сетът е сглобен, липсват части или кутията е повредена след доставката.',
        ],
      },
      {
        heading: 'Възстановяване на сумата',
        bullets: [
          'Връщаме всички получени от вас суми, включително цената на доставката до вас, без неоправдано забавяне и не по-късно от 14 дни от получаване на уведомлението за отказ.',
          'Можем да изчакаме с плащането, докато получим продукта обратно или ни покажете, че сте го изпратили — което стане по-рано.',
          'Тъй като плащате с наложен платеж или в брой при лично взимане, сумата се връща по банков път по посочената от вас сметка, без такси за вас. Ако върнете продукта лично на място, можем да ви върнем сумата и в брой.',
        ],
      },
      {
        heading: 'Кога правото на отказ не важи',
        paragraphs: [
          'Правото на отказ не се прилага за продукти, събрани или изработени специално по ваша поръчка и според ваши изисквания (например комплект части, подбран по ваш списък).',
        ],
      },
      {
        heading: 'Рекламации',
        paragraphs: [
          'Можете да прегледате пратката при куриера, преди да платите. Ако е повредена или не е това, което сте поръчали, имате право да откажете да я получите.',
          `Ако след получаване откриете, че продуктът не отговаря на описанието в обявата — липсват части, които сме посочили като налични, има неописана повреда или сте получили друг продукт — пишете ни възможно най-скоро на ${email} с номера на поръчката и снимки.`,
          'При основателна рекламация поемаме разходите за връщането и по ваш избор ще доставим липсващото, ще заменим продукта (ако имаме такъв) или ще ви възстановим сумата. Правата ви по закона за несъответствие на стоката с договора се запазват.',
          'При употребявани продукти състоянието и комплектността са описани в обявата — за рекламация се приема отклонение от това описание.',
        ],
      },
      {
        heading: 'Повече информация',
        paragraphs: ['Информация за правата ви като потребител има на сайта на Комисията за защита на потребителите.'],
        link: { label: 'kzp.bg', href: 'https://kzp.bg' },
      },
    ],
  }),
  terms: () => ({
    title: 'Общи условия',
    sections: [{ paragraphs: ['Тук ще бъдат публикувани общите условия на магазина.'] }],
  }),
  privacy: () => ({
    title: 'Политика за поверителност',
    sections: [
      {
        paragraphs: [
          'Използваме вашите данни (име, телефон, имейл, адрес) единствено за обработка и доставка на поръчките ви.',
          'Тук ще бъде публикувана пълната политика за защита на личните данни.',
        ],
      },
    ],
  }),
};

@Component({
  selector: 'app-info',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <article class="container-page max-w-3xl pt-10">
      @if (page(); as p) {
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ p.title }}</h1>
        <div class="mt-6 space-y-8 leading-relaxed text-fg-2">
          @for (section of p.sections; track $index) {
            <section class="space-y-3">
              @if (section.heading) {
                <h2 class="text-xl font-bold text-fg">{{ section.heading }}</h2>
              }
              @for (text of section.paragraphs ?? []; track $index) {
                <p>{{ text }}</p>
              }
              @if (section.bullets?.length) {
                <ul class="list-disc space-y-1.5 pl-5 marker:text-fg-faint">
                  @for (item of section.bullets; track $index) {
                    <li>{{ item }}</li>
                  }
                </ul>
              }
              @for (text of section.after ?? []; track $index) {
                <p>{{ text }}</p>
              }
              @if (section.link; as link) {
                <a [href]="link.href" target="_blank" rel="noopener" class="font-semibold text-accent hover:underline">{{ link.label }}</a>
              }
            </section>
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
    const build = PAGES[this.page_()];
    if (!build) return null;
    const settings = this.cart.settings();
    const page = build({
      email: SHOP_EMAIL || '[имейл за контакт]',
      // Returns go to the pickup place; without one we send the address when the return is requested
      address: settings?.pickup_address ? `адрес ${settings.pickup_address}` : 'адреса, който ще ви изпратим след заявяване на отказа',
    });
    if (this.page_() !== 'delivery' || (settings && !settings.pickup_enabled)) return page;
    // Pickup details come from the shop settings, same as at checkout
    const where = settings?.pickup_address ? ` на адрес ${settings.pickup_address}` : '';
    const hours = settings?.pickup_hours ? ` Работно време: ${settings.pickup_hours.charAt(0).toLowerCase()}${settings.pickup_hours.slice(1)}.` : '';
    const [first, ...rest] = page.sections;
    return {
      ...page,
      sections: [
        {
          ...first,
          paragraphs: [
            ...(first.paragraphs ?? []),
            `Можете да вземете поръчката и лично${where} — безплатно, с плащане в брой на място.${hours} Ще ви се обадим, когато е готова.`,
          ],
        },
        ...rest,
      ],
    };
  });
}
