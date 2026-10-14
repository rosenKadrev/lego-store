import { computed, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { LocalStorage } from './local-storage';

export type ConsentChoice = 'granted' | 'denied';

const STORAGE_KEY = 'consent.ads.v1';
/** Ask again after a year, as the data-protection regulators recommend */
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * The visitor's answer to the cookie banner. Ad scripts (Meta Pixel, Google tag) load only after "granted".
 * Without ad IDs in the environment there is nothing to ask about, so the banner stays hidden.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly storage = inject(LocalStorage);

  readonly needed = !!(environment.metaPixelId || environment.googleTagId);
  readonly choice = signal<ConsentChoice | null>(this.restore());
  private readonly reopened = signal(false);
  readonly bannerOpen = computed(() => this.needed && (this.choice() === null || this.reopened()));

  set(choice: ConsentChoice): void {
    this.choice.set(choice);
    this.reopened.set(false);
    this.storage.set(STORAGE_KEY, { choice, at: Date.now() });
  }

  /** The "Бисквитки" link in the footer */
  reopen(): void {
    this.reopened.set(true);
  }

  private restore(): ConsentChoice | null {
    const saved = this.storage.get<{ choice: ConsentChoice; at: number }>(STORAGE_KEY);
    if (!saved || Date.now() - saved.at > MAX_AGE_MS) return null;
    return saved.choice === 'granted' || saved.choice === 'denied' ? saved.choice : null;
  }
}
