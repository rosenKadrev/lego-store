import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2.5' },
  template: `
    <svg viewBox="0 0 40 40" class="size-9 lg:size-10" aria-hidden="true">
      <rect x="2" y="8" width="36" height="28" rx="6" class="fill-brick-600" />
      <rect x="7" y="3" width="10" height="8" rx="3" class="fill-brick-600" />
      <rect x="23" y="3" width="10" height="8" rx="3" class="fill-brick-600" />
      <rect x="9" y="5" width="6" height="2" rx="1" fill="white" opacity=".35" />
      <rect x="25" y="5" width="6" height="2" rx="1" fill="white" opacity=".35" />
      <path d="M12 22h16" stroke="white" stroke-width="3.2" stroke-linecap="round" />
    </svg>
    <span
      class="font-display inline-flex items-center text-xl leading-none font-extrabold tracking-tight lg:text-2xl"
      [class.text-white]="inverted()"
      [class.max-[359px]:sr-only]="collapsible()"
    >
      <span class="mr-1 rounded-md bg-stud-400 px-1.5 py-1.5 text-[0.85em] leading-none text-ink-900">MBR</span>Brick<span
        class="text-accent"
        >Store</span
      >
    </span>
  `,
})
export class Logo {
  readonly inverted = input(false);
  /** Show only the brick icon on very narrow screens (< 360px) */
  readonly collapsible = input(false);
}
