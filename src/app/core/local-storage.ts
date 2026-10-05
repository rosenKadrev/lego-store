import { Injectable } from '@angular/core';

/**
 * The only place that touches `localStorage`, so the app stays SSR-ready
 * and private-mode/blocked-storage errors never break a page.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorage {
  get<T>(key: string): T | null {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown): void {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or blocked — cart just won't survive a reload
    }
  }
}
