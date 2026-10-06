import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../stores/auth.store';
import { AuthShell } from './auth-shell';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/**
 * Landing page of the reset email. supabase-js reads the recovery token from the URL
 * and opens a session; with that session the user can set a new password.
 * Also usable by a logged-in user to change their password.
 */
@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShell],
  template: `
    <app-auth-shell title="Нова парола" subtitle="Изберете парола с поне 8 символа.">
      @if (!ready()) {
        <div class="h-40 animate-pulse rounded-2xl bg-surface-3"></div>
      } @else if (linkError()) {
        <div class="space-y-4 text-center">
          <p class="rounded-xl bg-accent-soft p-3 text-sm text-accent-ink">{{ linkError() }}</p>
          <a routerLink="/forgot-password" class="btn-primary w-full py-3">Поискай нов линк</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
          <div>
            <label class="label" for="password">Нова парола</label>
            <input id="password" class="input" type="password" formControlName="password" autocomplete="new-password" />
            @if (form.controls.password.touched && form.controls.password.invalid) {
              <p class="field-error">Поне 8 символа.</p>
            }
          </div>
          <div>
            <label class="label" for="confirm">Повторете паролата</label>
            <input id="confirm" class="input" type="password" formControlName="confirm" autocomplete="new-password" />
            @if (form.controls.confirm.touched && form.hasError('mismatch')) {
              <p class="field-error">Паролите не съвпадат.</p>
            }
          </div>
          @if (error()) {
            <p class="rounded-xl bg-accent-soft p-3 text-sm text-accent-ink">{{ error() }}</p>
          }
          <button type="submit" class="btn-primary w-full py-3" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Запис…' : 'Запази паролата' }}
          </button>
        </form>
      }
    </app-auth-shell>
  `,
})
export class ResetPassword implements OnInit {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  protected readonly ready = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly linkError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    // Supabase puts errors in the URL hash, e.g. #error_code=otp_expired
    const hash = new URLSearchParams(location.hash.slice(1));
    const urlError = hash.get('error_code') ?? new URLSearchParams(location.search).get('error_code');

    await this.auth.whenReady();
    if (urlError || !this.auth.isLoggedIn()) {
      this.linkError.set(
        urlError === 'otp_expired' || !urlError
          ? 'Линкът е невалиден или е изтекъл.'
          : 'Линкът не може да бъде използван. Поискайте нов.',
      );
    }
    this.ready.set(true);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const error = await this.auth.updatePassword(this.form.getRawValue().password);
    this.loading.set(false);
    if (error) {
      this.error.set(error);
      return;
    }
    void this.router.navigate(['/account'], { replaceUrl: true, state: { passwordChanged: true } });
  }
}
