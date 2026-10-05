import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../stores/auth.store';
import { AuthShell } from './auth-shell';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShell],
  template: `
    <app-auth-shell title="Вход" subtitle="Влезте, за да следите поръчките си.">
      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
        <div>
          <label class="label" for="email">Имейл</label>
          <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
        </div>
        <div>
          <div class="mb-1.5 flex items-baseline justify-between">
            <label class="label mb-0" for="password">Парола</label>
            <a routerLink="/forgot-password" class="text-xs font-medium text-brick-600 hover:underline">Забравена парола?</a>
          </div>
          <input id="password" class="input" type="password" formControlName="password" autocomplete="current-password" />
        </div>
        @if (error()) {
          <p class="rounded-xl bg-brick-50 p-3 text-sm text-brick-800">{{ error() }}</p>
        }
        <button type="submit" class="btn-primary w-full py-3" [disabled]="form.invalid || loading()">
          {{ loading() ? 'Влизане…' : 'Вход' }}
        </button>
      </form>
      <p class="mt-6 text-center text-sm text-zinc-600">
        Нямате профил?
        <a routerLink="/register" [queryParams]="{ redirect: redirect() }" class="font-semibold text-brick-600 hover:underline">Регистрация</a>
      </p>
    </app-auth-shell>
  `,
})
export class Login {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  /** `?redirect=/checkout` — where to go after login. */
  readonly redirect = input<string | undefined>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    const error = await this.auth.signIn(email.trim(), password);
    this.loading.set(false);
    if (error) {
      this.error.set(error);
      return;
    }
    void this.router.navigateByUrl(safeRedirect(this.redirect()) ?? (this.auth.isAdmin() ? '/admin' : '/account'));
  }
}

/** Only allow in-app paths, never `//evil.com` or absolute URLs. */
export function safeRedirect(url: string | undefined): string | null {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
}
