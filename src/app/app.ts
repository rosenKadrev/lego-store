import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Analytics } from './core/analytics';
import { CartDrawer } from './layout/cart-drawer';
import { CookieBanner } from './layout/cookie-banner';
import { Footer } from './layout/footer';
import { Header } from './layout/header';
import { Toaster } from './layout/toaster';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Footer, CartDrawer, Toaster, CookieBanner],
  host: { class: 'flex min-h-dvh flex-col' },
  template: `
    <app-header />
    <main class="flex-1">
      <router-outlet />
    </main>
    <app-footer />
    <app-cart-drawer />
    <app-toaster />
    <app-cookie-banner />
  `,
})
export class App {
  constructor() {
    // Page views on every route change; loads the ad tags once the visitor consents
    inject(Analytics);
  }
}
