import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon, IconName } from '../shared/icon';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
    <div class="container-page pt-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Админ панел</h1>
        <a routerLink="/admin/listings/new" class="btn-primary"><app-icon name="plus" [size]="18" /> Нова обява</a>
      </div>
      <nav class="mt-5 flex gap-1 border-b border-line" aria-label="Админ навигация">
        @for (link of links; track link.path) {
          <a
            [routerLink]="link.path"
            routerLinkActive="!border-brick-600 !text-fg"
            [routerLinkActiveOptions]="{ exact: link.exact }"
            class="-mb-px flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold whitespace-nowrap text-fg-muted hover:text-fg"
          >
            <app-icon [name]="link.icon" [size]="18" /> {{ link.label }}
          </a>
        }
      </nav>
      <div class="pt-6">
        <router-outlet />
      </div>
    </div>
  `,
})
export class AdminLayout {
  protected readonly links: { path: string; label: string; icon: IconName; exact: boolean }[] = [
    { path: '/admin/orders', label: 'Поръчки', icon: 'box', exact: false },
    { path: '/admin/listings', label: 'Обяви', icon: 'brick', exact: true },
  ];
}
