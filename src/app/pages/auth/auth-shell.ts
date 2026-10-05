import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-page grid min-h-[70vh] place-items-center py-10">
      <div class="w-full max-w-md">
        <div class="card p-6 shadow-xl shadow-zinc-200/60 sm:p-8">
          <h1 class="text-3xl font-extrabold tracking-tight">{{ title() }}</h1>
          @if (subtitle()) {
            <p class="mt-1 mb-6 text-sm text-zinc-500">{{ subtitle() }}</p>
          }
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class AuthShell {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
