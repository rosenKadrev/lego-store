import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CartDrawer } from './layout/cart-drawer';
import { Footer } from './layout/footer';
import { Header } from './layout/header';
import { Toaster } from './layout/toaster';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Header, Footer, CartDrawer, Toaster],
  host: { class: 'flex min-h-dvh flex-col' },
  template: `
    <app-header />
    <main class="flex-1">
      <router-outlet />
    </main>
    <app-footer />
    <app-cart-drawer />
    <app-toaster />
  `,
})
export class App {}
