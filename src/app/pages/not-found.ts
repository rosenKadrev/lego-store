import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="container-page flex flex-col items-center py-24 text-center">
      <p class="font-display text-8xl font-extrabold text-brick-600">404</p>
      <h1 class="mt-4 text-2xl font-bold">Тази тухличка липсва</h1>
      <p class="mt-2 text-zinc-500">Страницата, която търсите, не съществува.</p>
      <a routerLink="/" class="btn-primary mt-8">Към началото</a>
    </div>
  `,
})
export class NotFound {}
