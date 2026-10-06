import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { LocalStorage } from './local-storage';

export type ThemeMode = 'light' | 'dark';

/** Must match the inline script in index.html, which applies the theme before Angular boots */
const STORAGE_KEY = 'theme';

/**
 * Light/dark mode. Follows the OS setting until the user picks one with the header toggle;
 * the choice is then remembered. Applied as a `.dark` class on <html> (see styles.css).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(LocalStorage);
  private readonly media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

  private readonly chosen = signal<ThemeMode | null>(this.storage.get<ThemeMode>(STORAGE_KEY));
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly mode = computed<ThemeMode>(() => this.chosen() ?? (this.systemDark() ? 'dark' : 'light'));

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => globalThis.document?.documentElement.classList.toggle('dark', this.mode() === 'dark'));
  }

  toggle(): void {
    const next: ThemeMode = this.mode() === 'dark' ? 'light' : 'dark';
    this.chosen.set(next);
    this.storage.set(STORAGE_KEY, next);
  }
}
