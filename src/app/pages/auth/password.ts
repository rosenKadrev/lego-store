import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Icon } from '../../shared/icon';

/** Group validator: `password` and `confirm` must be the same */
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/**
 * Eye button inside a password field that shows / hides what was typed. Put it after the input in a
 * `relative` wrapper and give the input `pr-11` and `[type]="shown ? 'text' : 'password'"`.
 */
@Component({
  selector: 'app-password-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { class: 'absolute inset-y-0 right-1 flex items-center' },
  template: `
    <button
      type="button"
      class="grid size-9 place-items-center rounded-lg text-fg-muted transition hover:bg-surface-3 hover:text-fg"
      [attr.aria-label]="shown() ? 'Скрий паролата' : 'Покажи паролата'"
      [attr.aria-pressed]="shown()"
      [title]="shown() ? 'Скрий паролата' : 'Покажи паролата'"
      (click)="toggle.emit()"
    >
      <app-icon [name]="shown() ? 'eyeOff' : 'eye'" [size]="18" />
    </button>
  `,
})
export class PasswordToggle {
  readonly shown = input.required<boolean>();
  readonly toggle = output<void>();
}
