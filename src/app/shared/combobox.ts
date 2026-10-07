import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';
import { ColorSwatch } from './color-swatch';
import { Icon } from './icon';

/** `rgb` shows a colour dot, `hint` a muted note on the right (e.g. a count) */
export type ComboboxOption = { id: number; name: string; rgb?: string; trans?: boolean; hint?: string };

/**
 * Searchable dropdown: type to filter, or open it and pick from the whole list.
 * Keyboard: ↑ ↓ to move, Enter to pick, Esc to close.
 */
@Component({
  selector: 'app-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, ColorSwatch],
  host: { class: 'relative block', '(document:mousedown)': 'onDocumentMouseDown($event)' },
  template: `
    <input
      [id]="inputId()"
      class="input pr-16"
      role="combobox"
      autocomplete="off"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="inputId() + '-list'"
      [attr.aria-activedescendant]="open() && active() >= 0 ? inputId() + '-opt-' + active() : null"
      [placeholder]="placeholder()"
      [value]="open() ? query() : selectedName()"
      (focus)="openList()"
      (click)="openList()"
      (input)="onInput($any($event.target).value)"
      (keydown)="onKeydown($event)"
    />
    <div class="absolute inset-y-0 right-2 flex items-center gap-0.5">
      @if (value() != null) {
        <button type="button" class="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label="Изчисти" (click)="pick(null)">
          <app-icon name="close" [size]="14" />
        </button>
      }
      <button type="button" class="grid size-7 place-items-center rounded-full text-fg-muted hover:bg-surface-3" tabindex="-1" aria-hidden="true" (click)="open() ? close() : openList()">
        <app-icon name="chevronDown" [size]="16" class="transition" [class.rotate-180]="open()" />
      </button>
    </div>

    @if (open()) {
      <ul
        [id]="inputId() + '-list'"
        role="listbox"
        class="card absolute top-full right-0 left-0 z-30 mt-1 max-h-64 overflow-y-auto p-1 shadow-xl shadow-zinc-300/50 dark:shadow-black/40"
      >
        @for (o of filtered(); track o.id; let i = $index) {
          <li
            [id]="inputId() + '-opt-' + i"
            role="option"
            [attr.aria-selected]="o.id === value()"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm"
            [class.bg-surface-3]="i === active()"
            [class.font-semibold]="o.id === value()"
            (mousedown)="$event.preventDefault(); pick(o.id)"
            (mouseenter)="active.set(i)"
          >
            @if (o.rgb) {
              <app-color-swatch [rgb]="o.rgb" [trans]="!!o.trans" [size]="12" />
            }
            <span class="min-w-0 flex-1 truncate">{{ o.name }}</span>
            @if (o.hint) {
              <span class="text-xs font-normal text-fg-muted">{{ o.hint }}</span>
            }
          </li>
        } @empty {
          <li class="px-3 py-2 text-sm text-fg-muted">Няма „{{ query() }}“</li>
        }
      </ul>
    }
  `,
})
export class Combobox {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<ComboboxOption[]>();
  readonly value = input<number | null>(null);
  readonly placeholder = input('');
  readonly inputId = input('combobox');
  readonly valueChange = output<number | null>();

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly active = signal(-1);

  protected readonly selectedName = computed(() => this.options().find((o) => o.id === this.value())?.name ?? '');
  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.options();
    // Names starting with the text first, then the ones containing it
    const starts = this.options().filter((o) => o.name.toLowerCase().startsWith(q));
    const contains = this.options().filter((o) => !o.name.toLowerCase().startsWith(q) && o.name.toLowerCase().includes(q));
    return [...starts, ...contains];
  });

  protected openList(): void {
    if (this.open()) return;
    this.query.set('');
    this.active.set(this.filtered().findIndex((o) => o.id === this.value()));
    this.open.set(true);
  }

  protected close(): void {
    this.open.set(false);
    this.query.set('');
  }

  protected onInput(text: string): void {
    this.query.set(text);
    this.open.set(true);
    this.active.set(text.trim() ? 0 : -1);
  }

  protected pick(id: number | null): void {
    this.valueChange.emit(id);
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.filtered().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) this.openList();
        else if (count) this.active.set((this.active() + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) this.active.set((this.active() - 1 + count) % count);
        break;
      case 'Enter': {
        const option = this.filtered()[this.active()];
        if (this.open() && option) {
          event.preventDefault();
          this.pick(option.id);
        }
        break;
      }
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  protected onDocumentMouseDown(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
