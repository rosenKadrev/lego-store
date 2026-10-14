import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsentService } from '../core/consent';

/** Asks before any ad script loads. "Отказвам" and "Приемам" carry equal weight, as the law requires. */
@Component({
  selector: 'app-cookie-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (consent.bannerOpen()) {
      <div
        class="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface p-4 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:rounded-2xl sm:border"
        role="dialog"
        aria-labelledby="cookie-banner-title"
      >
        <h2 id="cookie-banner-title" class="font-display text-base font-bold">Бисквитки за реклама</h2>
        <p class="mt-2 text-sm leading-relaxed text-fg-2">
          С ваше съгласие ползваме бисквитки на Meta (Facebook, Instagram) и Google, за да измерваме рекламите си и да
          ви показваме наши продукти в тях. Сайтът работи напълно и без тях. Можете да промените избора си по всяко
          време от „Настройки за бисквитки“ в долната част на страницата.
          <a routerLink="/info/privacy" class="font-semibold text-accent hover:underline">Повече</a>
        </p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <button type="button" class="btn-outline" (click)="consent.set('denied')">Отказвам</button>
          <button type="button" class="btn-outline" (click)="consent.set('granted')">Приемам</button>
        </div>
      </div>
    }
  `,
})
export class CookieBanner {
  protected readonly consent = inject(ConsentService);
}
