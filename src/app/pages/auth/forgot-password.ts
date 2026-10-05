import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { AuthStore } from '../../stores/auth.store';
import { AuthShell } from './auth-shell';

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AuthShell, Icon],
  template: `
    <app-auth-shell title="Забравена парола" subtitle="Ще ви изпратим линк за избор на нова парола.">
      @if (sentTo(); as email) {
        <div class="flex flex-col items-center gap-3 py-4 text-center">
          <app-icon name="check" [size]="40" class="text-emerald-600" />
          <p class="font-semibold">Проверете пощата си</p>
          <p class="text-sm text-zinc-500">
            Ако има профил с <b class="text-ink-900">{{ email }}</b>, ще получите имейл с линк. Линкът е валиден 1 час.
          </p>
          <button type="button" class="btn-ghost mt-2" (click)="sentTo.set(null)">Изпрати отново</button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
          <div>
            <label class="label" for="email">Имейл</label>
            <input id="email" class="input" type="email" formControlName="email" autocomplete="email" />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="field-error">Въведете валиден имейл.</p>
            }
          </div>
          @if (error()) {
            <p class="rounded-xl bg-brick-50 p-3 text-sm text-brick-800">{{ error() }}</p>
          }
          <button type="submit" class="btn-primary w-full py-3" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Изпращане…' : 'Изпрати линк' }}
          </button>
        </form>
      }
      <p class="mt-6 text-center text-sm text-zinc-600">
        <a routerLink="/login" class="font-semibold text-brick-600 hover:underline">Обратно към вход</a>
      </p>
    </app-auth-shell>
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthStore);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sentTo = signal<string | null>(null);

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    const email = this.form.getRawValue().email.trim();
    const error = await this.auth.requestPasswordReset(email);
    this.loading.set(false);
    if (error) this.error.set(error);
    else this.sentTo.set(email);
  }
}
