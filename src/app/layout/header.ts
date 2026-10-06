import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { SHOP_NAME } from '../core/models';
import { ThemeService } from '../core/theme';
import { Icon } from '../shared/icon';
import { Logo } from '../shared/logo';
import { SearchBox } from './search-box';
import { AuthStore } from '../stores/auth.store';
import { CartStore } from '../stores/cart.store';
import { FavoritesStore } from '../stores/favorites.store';
import { MENU_THEME_LIMIT, ThemesStore } from '../stores/themes.store';

type NavLink = { label: string; params: Record<string, string> };

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, Logo, SearchBox],
  host: { class: 'sticky top-0 z-40 block' },
  template: `
    <div class="bg-ink-900 text-xs text-white">
      <div class="container-page flex h-9 items-center justify-center gap-6 overflow-hidden whitespace-nowrap">
        <span class="flex items-center gap-1.5"><app-icon name="box" [size]="15" /> Безплатно взимане от място</span>
        <span class="hidden items-center gap-1.5 sm:flex"><app-icon name="cash" [size]="15" /> Плащане с наложен платеж при доставка</span>
        <span class="hidden items-center gap-1.5 md:flex"><app-icon name="eye" [size]="15" /> Преглед преди плащане</span>
      </div>
    </div>

    <div class="border-b border-line bg-page/90 backdrop-blur-lg">
      <div class="container-page flex h-16 items-center gap-1.5 sm:gap-3 lg:h-20 lg:gap-5 xl:gap-8">
        <button type="button" class="btn-ghost -ml-2 size-9 p-0 sm:size-10 lg:hidden" aria-label="Меню" (click)="menuOpen.set(true)">
          <app-icon name="menu" [size]="22" />
        </button>

        <a routerLink="/" class="min-w-0 shrink-0" [attr.aria-label]="shopName">
          <app-logo [collapsible]="true" />
        </a>

        <nav class="hidden items-center gap-1 lg:flex" aria-label="Основна навигация">
          @for (link of links; track link.label) {
            <a
              routerLink="/catalog"
              [queryParams]="link.params"
              routerLinkActive="!text-accent"
              [routerLinkActiveOptions]="{ queryParams: 'subset', matrixParams: 'ignored', paths: 'exact', fragment: 'ignored' }"
              class="rounded-full px-2.5 py-2 text-sm font-semibold whitespace-nowrap text-fg transition hover:bg-surface-3 xl:px-3"
              >{{ link.label }}</a
            >
          }
          <div class="relative" (mouseenter)="themesOpen.set(true)" (mouseleave)="themesOpen.set(false)">
            <button
              type="button"
              class="flex items-center gap-1 rounded-full px-2.5 py-2 text-sm font-semibold whitespace-nowrap text-fg transition hover:bg-surface-3 xl:px-3"
              [attr.aria-expanded]="themesOpen()"
              (click)="themesOpen.set(!themesOpen())"
            >
              Теми <app-icon name="chevronDown" [size]="16" />
            </button>
            @if (themesOpen()) {
              <div class="absolute top-full left-0 w-[34rem] pt-2">
                <div class="card grid grid-cols-2 gap-1 p-3 shadow-2xl shadow-zinc-300/50 dark:shadow-black/40">
                  @for (theme of themes.listed().slice(0, menuLimit); track theme.theme_id) {
                    <a
                      routerLink="/catalog"
                      [queryParams]="{ theme: theme.theme_id }"
                      class="flex items-center gap-3 rounded-xl p-2 text-sm hover:bg-surface-2"
                    >
                      <span class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-well">
                        @if (theme.sample_img_url) {
                          <img [src]="theme.sample_img_url" alt="" class="size-full object-contain mix-blend-multiply" />
                        }
                      </span>
                      <span class="font-medium">{{ theme.name }}</span>
                      <span class="ml-auto text-xs text-fg-faint">{{ theme.listing_count }}</span>
                    </a>
                  } @empty {
                    <p class="col-span-2 p-3 text-sm text-fg-muted">Все още няма продукти.</p>
                  }
                  @if (themes.listed().length > menuLimit) {
                    <a
                      routerLink="/themes"
                      class="col-span-2 mt-1 flex items-center justify-center gap-1 rounded-xl border-t border-line-soft p-3 text-sm font-semibold text-accent hover:bg-accent-soft"
                    >
                      Виж всички теми ({{ themes.listed().length }}) <app-icon name="arrowRight" [size]="16" />
                    </a>
                  }
                </div>
              </div>
            }
          </div>
        </nav>

        <app-search-box class="ml-auto hidden max-w-xs flex-1 md:block lg:hidden xl:block" />

        <div class="ml-auto flex shrink-0 items-center sm:gap-1 md:ml-0">
          <button
            type="button"
            class="btn-ghost size-9 p-0 sm:size-10 md:hidden lg:inline-flex xl:hidden"
            aria-label="Търсене"
            (click)="mobileSearchOpen.set(!mobileSearchOpen())"
          >
            <app-icon name="search" [size]="22" />
          </button>

          <button
            type="button"
            class="btn-ghost size-9 p-0 sm:size-10"
            [attr.aria-label]="theme.mode() === 'dark' ? 'Светла тема' : 'Тъмна тема'"
            [attr.title]="theme.mode() === 'dark' ? 'Светла тема' : 'Тъмна тема'"
            (click)="theme.toggle()"
          >
            <app-icon [name]="theme.mode() === 'dark' ? 'sun' : 'moon'" [size]="22" />
          </button>

          @if (auth.isLoggedIn()) {
            <div class="relative">
              <button
                type="button"
                class="btn-ghost h-9 gap-2 px-1.5 sm:h-10 sm:px-3"
                [attr.aria-expanded]="accountOpen()"
                (click)="accountOpen.set(!accountOpen())"
              >
                <app-icon name="user" [size]="22" />
                <span class="hidden max-w-28 truncate text-sm 2xl:inline">Здравей, <b>{{ auth.displayName() }}</b></span>
                <app-icon name="chevronDown" [size]="16" class="hidden 2xl:inline-flex" />
              </button>
              @if (accountOpen()) {
                <div class="fixed inset-0 z-10" (click)="accountOpen.set(false)"></div>
                <div class="card absolute right-0 z-20 mt-2 w-56 p-2 shadow-2xl shadow-zinc-300/50 dark:shadow-black/40">
                  <a routerLink="/account" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                    <app-icon name="user" [size]="18" /> Моят профил
                  </a>
                  @if (auth.isAdmin()) {
                    <a routerLink="/admin" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                      <app-icon name="settings" [size]="18" /> Админ панел
                    </a>
                  }
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent-strong hover:bg-accent-soft"
                    (click)="signOut()"
                  >
                    <app-icon name="logout" [size]="18" /> Изход
                  </button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/login" class="btn-ghost h-9 gap-2 px-1.5 sm:h-10 sm:px-3" aria-label="Вход">
              <app-icon name="user" [size]="22" />
              <span class="hidden text-sm xl:inline">Вход</span>
            </a>
          }

          <a routerLink="/favorites" class="btn-ghost relative hidden size-10 p-0 sm:inline-flex" aria-label="Любими" title="Любими">
            <app-icon name="heart" [size]="22" />
            @if (favorites.count()) {
              <span
                class="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-inverse px-1 text-[11px] leading-5 font-bold text-on-inverse"
                >{{ favorites.count() }}</span
              >
            }
          </a>

          <button type="button" class="btn-ghost relative size-9 p-0 sm:size-10" aria-label="Количка" (click)="cart.openDrawer()">
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
        <div class="container-page pb-3 md:hidden lg:block xl:hidden"><app-search-box class="block" [autofocus]="true" /></div>
      }
    </div>

    <!-- Mobile menu -->
    @if (menuOpen()) {
      <div class="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Меню">
        <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" (click)="menuOpen.set(false)"></div>
        <div class="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-surface shadow-2xl">
          <div class="flex h-16 items-center justify-between border-b border-line-soft px-4">
            <app-logo />
            <button type="button" class="btn-ghost size-10 p-0" aria-label="Затвори" (click)="menuOpen.set(false)">
              <app-icon name="close" />
            </button>
          </div>
          <nav class="flex flex-col p-3">
            @for (link of links; track link.label) {
              <a routerLink="/catalog" [queryParams]="link.params" class="rounded-xl px-3 py-3 font-semibold hover:bg-surface-2">{{
                link.label
              }}</a>
            }
            <a routerLink="/favorites" class="flex items-center justify-between rounded-xl px-3 py-3 font-semibold hover:bg-surface-2">
              <span class="flex items-center gap-2"><app-icon name="heart" [size]="18" /> Любими</span>
              @if (favorites.count()) {
                <span class="text-xs font-normal text-fg-faint">{{ favorites.count() }}</span>
              }
            </a>
          </nav>
          <p class="px-6 pt-2 text-xs font-semibold tracking-wider text-fg-faint uppercase">Теми</p>
          <nav class="flex flex-col p-3">
            @for (theme of themes.listed().slice(0, menuLimit); track theme.theme_id) {
              <a
                routerLink="/catalog"
                [queryParams]="{ theme: theme.theme_id }"
                class="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-surface-2"
              >
                {{ theme.name }} <span class="text-xs text-fg-faint">{{ theme.listing_count }}</span>
              </a>
            }
            @if (themes.listed().length > menuLimit) {
              <a routerLink="/themes" class="flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-accent hover:bg-accent-soft">
                Виж всички теми ({{ themes.listed().length }}) <app-icon name="arrowRight" [size]="16" />
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
  protected readonly favorites = inject(FavoritesStore);
  protected readonly themes = inject(ThemesStore);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly shopName = SHOP_NAME;
  protected readonly menuLimit = MENU_THEME_LIMIT;
  protected readonly links: NavLink[] = [
    { label: 'Нови сетове', params: { condition: 'new', type: 'set' } },
    { label: 'Употребявани', params: { condition: 'used' } },
    { label: 'Минифигурки', params: { type: 'minifig' } },
    { label: 'Части', params: { type: 'part' } },
  ];

  protected readonly menuOpen = signal(false);
  protected readonly themesOpen = signal(false);
  protected readonly accountOpen = signal(false);
  protected readonly mobileSearchOpen = signal(false);


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

    // Sticky elements below the header (catalog toolbar / filters) read its live height
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const root = document.documentElement;
      const observer = new ResizeObserver(() => root.style.setProperty('--header-h', `${host.offsetHeight}px`));
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }


  protected async signOut(): Promise<void> {
    this.accountOpen.set(false);
    await this.auth.signOut();
    void this.router.navigateByUrl('/');
  }
}
