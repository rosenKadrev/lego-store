import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { AuthStore } from '../../stores/auth.store';
import { AuthShell } from './auth-shell';
import { safeRedirect } from './login';

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Icon],
  template: `
    <app-auth-shell title="Регистрация" subtitle="Бърза поръчка и история на покупките.">
      @if (confirmationSent()) {
        <div class="flex flex-col items-center gap-3 py-4 text-center">
          <app-icon name="check" [size]="40" class="text-emerald-600" />
          <p class="font-semibold">Изпратихме ви имейл за потвърждение.</p>
          <p class="text-sm text-zinc-500">Отворете линка в него, за да активирате профила си.</p>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
          <div>
            <label class="label" for="fullName">Име и фамилия</label>
            <input id="fullName" class="input" formControlName="fullName" autocomplete="name" />
          </div>
          <div>
            <label class="label" for="phone">Телефон</label>
            <input id="phone" class="input" type="tel" formControlName="phone" autocomplete="tel" placeholder="0888 123 456" />
          </div>
          <div>
            <label class="label" for="email">Имейл</label>
            <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="field-error">Въведете валиден имейл.</p>
            }
          </div>
          <div>
            <label class="label" for="password">Парола</label>
            <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" />
            <p class="mt-1 text-xs text-zinc-500">Поне 8 символа.</p>
          </div>
          @if (error()) {
            <p class="rounded-xl bg-brick-50 p-3 text-sm text-brick-800">{{ error() }}</p>
          }
          <button type="submit" class="btn-primary w-full py-3" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Създаване…' : 'Създай профил' }}
          </button>
        </form>
        <p class="mt-6 text-center text-sm text-zinc-600">
          Вече имате профил?
          <a routerLink="/login" [queryParams]="{ redirect: redirect() }" class="font-semibold text-brick-600 hover:underline">Вход</a>
        </p>
      }
    </app-auth-shell>
  `,
})
export class Register {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly redirect = input<string | undefined>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmationSent = signal(false);

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    const result = await this.auth.signUp({
      email: v.email.trim(),
      password: v.password,
      fullName: v.fullName.trim(),
      phone: v.phone.trim(),
    });
    this.loading.set(false);
    if (result.error) {
      this.error.set(result.error);
    } else if (result.needsConfirmation) {
      this.confirmationSent.set(true);
    } else {
      void this.router.navigateByUrl(safeRedirect(this.redirect()) ?? '/account');
    }
  }
}
