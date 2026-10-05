import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { SHOP_NAME } from '../core/models';
import { Icon } from '../shared/icon';
import { Logo } from '../shared/logo';
import { AuthStore } from '../stores/auth.store';
import { CartStore } from '../stores/cart.store';
import { ThemesStore } from '../stores/themes.store';

type NavLink = { label: string; params: Record<string, string> };

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, FormsModule, Icon, Logo],
  host: { class: 'sticky top-0 z-40 block' },
  template: `
    <div class="bg-ink-900 text-xs text-white">
      <div class="container-page flex h-9 items-center justify-center gap-6 overflow-hidden whitespace-nowrap">
        <span class="flex items-center gap-1.5"><app-icon name="truck" [size]="15" /> Безплатна доставка над {{ freeShipping() }} €</span>
        <span class="hidden items-center gap-1.5 sm:flex"><app-icon name="cash" [size]="15" /> Плащане с наложен платеж</span>
        <span class="hidden items-center gap-1.5 md:flex"><app-icon name="eye" [size]="15" /> Преглед преди плащане</span>
      </div>
    </div>

    <div class="border-b border-zinc-200 bg-white/90 backdrop-blur-lg">
      <div class="container-page flex h-16 items-center gap-3 lg:h-20 lg:gap-8">
        <button type="button" class="btn-ghost -ml-2 size-10 p-0 lg:hidden" aria-label="Меню" (click)="menuOpen.set(true)">
          <app-icon name="menu" [size]="22" />
        </button>

        <a routerLink="/" class="shrink-0" [attr.aria-label]="shopName">
          <app-logo />
        </a>

        <nav class="hidden items-center gap-1 lg:flex" aria-label="Основна навигация">
          @for (link of links; track link.label) {
            <a
              routerLink="/catalog"
              [queryParams]="link.params"
              routerLinkActive="!text-brick-600"
              [routerLinkActiveOptions]="{ queryParams: 'subset', matrixParams: 'ignored', paths: 'exact', fragment: 'ignored' }"
              class="rounded-full px-3 py-2 text-sm font-semibold text-ink-800 transition hover:bg-zinc-100"
              >{{ link.label }}</a
            >
          }
          <div class="relative" (mouseenter)="themesOpen.set(true)" (mouseleave)="themesOpen.set(false)">
            <button
              type="button"
              class="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-ink-800 transition hover:bg-zinc-100"
              [attr.aria-expanded]="themesOpen()"
              (click)="themesOpen.set(!themesOpen())"
            >
              Теми <app-icon name="chevronDown" [size]="16" />
            </button>
            @if (themesOpen()) {
              <div class="absolute top-full left-0 w-[34rem] pt-2">
                <div class="card grid grid-cols-2 gap-1 p-3 shadow-2xl shadow-zinc-300/50">
                  @for (theme of themes.listed(); track theme.theme_id) {
                    <a
                      routerLink="/catalog"
                      [queryParams]="{ theme: theme.theme_id }"
                      class="flex items-center gap-3 rounded-xl p-2 text-sm hover:bg-zinc-50"
                    >
                      <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-zinc-100">
                        @if (theme.sample_img_url) {
                          <img [src]="theme.sample_img_url" alt="" class="size-full object-contain mix-blend-multiply" />
                        }
                      </span>
                      <span class="font-medium">{{ theme.name }}</span>
                      <span class="ml-auto text-xs text-zinc-400">{{ theme.listing_count }}</span>
                    </a>
                  } @empty {
                    <p class="col-span-2 p-3 text-sm text-zinc-500">Все още няма продукти.</p>
                  }
                </div>
              </div>
            }
          </div>
        </nav>

        <form class="relative ml-auto hidden max-w-xs flex-1 md:block" role="search" (submit)="search($event)">
          <app-icon name="search" [size]="18" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            name="q"
            [(ngModel)]="query"
            placeholder="Търси сет, номер, фигурка…"
            class="w-full rounded-full border-0 bg-zinc-100 py-2.5 pr-4 pl-10 text-sm transition focus:bg-white focus:ring-2 focus:ring-brick-600 focus:outline-none"
          />
        </form>

        <div class="ml-auto flex items-center gap-1 md:ml-0">
          <button
            type="button"
            class="btn-ghost size-10 p-0 md:hidden"
            aria-label="Търсене"
            (click)="mobileSearchOpen.set(!mobileSearchOpen())"
          >
            <app-icon name="search" [size]="22" />
          </button>

          @if (auth.isLoggedIn()) {
            <div class="relative">
              <button
                type="button"
                class="btn-ghost h-10 gap-2 px-2 sm:px-3"
                [attr.aria-expanded]="accountOpen()"
                (click)="accountOpen.set(!accountOpen())"
              >
                <app-icon name="user" [size]="22" />
                <span class="hidden max-w-28 truncate text-sm xl:inline">Здравей, <b>{{ auth.displayName() }}</b></span>
                <app-icon name="chevronDown" [size]="16" class="hidden xl:inline-flex" />
              </button>
              @if (accountOpen()) {
                <div class="fixed inset-0 z-10" (click)="accountOpen.set(false)"></div>
                <div class="card absolute right-0 z-20 mt-2 w-56 p-2 shadow-2xl shadow-zinc-300/50">
                  <a routerLink="/account" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">
                    <app-icon name="user" [size]="18" /> Моят профил
                  </a>
                  @if (auth.isAdmin()) {
                    <a routerLink="/admin" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">
                      <app-icon name="settings" [size]="18" /> Админ панел
                    </a>
                  }
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brick-700 hover:bg-brick-50"
                    (click)="signOut()"
                  >
                    <app-icon name="logout" [size]="18" /> Изход
                  </button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/login" class="btn-ghost h-10 gap-2 px-2 sm:px-3" aria-label="Вход">
              <app-icon name="user" [size]="22" />
              <span class="hidden text-sm xl:inline">Вход</span>
            </a>
          }

          <button type="button" class="btn-ghost relative size-10 p-0" aria-label="Количка" (click)="cart.openDrawer()">
            <app-icon name="cart" [size]="22" />
            @if (cart.count()) {
              <span
                class="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-brick-600 px-1 text-[11px] leading-5 font-bold text-white"
                >{{ cart.count() }}</span
              >
            }
          </button>
        </div>
      </div>

      @if (mobileSearchOpen()) {
        <form class="container-page pb-3 md:hidden" role="search" (submit)="search($event)">
          <input type="search" name="q" [(ngModel)]="query" placeholder="Търси сет, номер, фигурка…" class="input rounded-full" autofocus />
        </form>
      }
    </div>

    <!-- Mobile menu -->
    @if (menuOpen()) {
      <div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Меню">
        <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" (click)="menuOpen.set(false)"></div>
        <div class="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">
          <div class="flex h-16 items-center justify-between border-b border-zinc-100 px-4">
            <app-logo />
            <button type="button" class="btn-ghost size-10 p-0" aria-label="Затвори" (click)="menuOpen.set(false)">
              <app-icon name="close" />
            </button>
          </div>
          <nav class="flex flex-col p-3">
            @for (link of links; track link.label) {
              <a routerLink="/catalog" [queryParams]="link.params" class="rounded-xl px-3 py-3 font-semibold hover:bg-zinc-50">{{
                link.label
              }}</a>
            }
          </nav>
          <p class="px-6 pt-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">Теми</p>
          <nav class="flex flex-col p-3">
            @for (theme of themes.listed(); track theme.theme_id) {
              <a
                routerLink="/catalog"
                [queryParams]="{ theme: theme.theme_id }"
                class="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-zinc-50"
              >
                {{ theme.name }} <span class="text-xs text-zinc-400">{{ theme.listing_count }}</span>
              </a>
            }
          </nav>
        </div>
      </div>
    }
  `,
})
export class Header {
  protected readonly auth = inject(AuthStore);
  protected readonly cart = inject(CartStore);
  protected readonly themes = inject(ThemesStore);
  private readonly router = inject(Router);

  protected readonly shopName = SHOP_NAME;
  protected readonly links: NavLink[] = [
    { label: 'Нови сетове', params: { condition: 'new', type: 'set' } },
    { label: 'Употребявани', params: { condition: 'used' } },
    { label: 'Минифигурки', params: { type: 'minifig' } },
  ];

  protected readonly menuOpen = signal(false);
  protected readonly themesOpen = signal(false);
  protected readonly accountOpen = signal(false);
  protected readonly mobileSearchOpen = signal(false);
  protected query = '';

  protected freeShipping(): number {
    return this.cart.freeShippingThreshold();
  }

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.menuOpen.set(false);
        this.themesOpen.set(false);
        this.accountOpen.set(false);
        this.mobileSearchOpen.set(false);
      });
  }

  protected search(event: Event): void {
    event.preventDefault();
    const q = this.query.trim();
    void this.router.navigate(['/catalog'], { queryParams: q ? { q } : {} });
  }

  protected async signOut(): Promise<void> {
    this.accountOpen.set(false);
    await this.auth.signOut();
    void this.router.navigateByUrl('/');
  }
}
