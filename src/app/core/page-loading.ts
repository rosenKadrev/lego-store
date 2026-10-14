import { computed, Injectable, signal } from '@angular/core';

/**
 * Data the visitor is waiting for (products on the catalog, product and home pages).
 * While anything is tracked here the red bar at the top of the page is shown (see RouteProgress).
 */
@Injectable({ providedIn: 'root' })
export class PageLoading {
  private readonly pending = signal(0);
  readonly active = computed(() => this.pending() > 0);

  async track<T>(work: PromiseLike<T>): Promise<T> {
    this.pending.update((n) => n + 1);
    try {
      return await work;
    } finally {
      this.pending.update((n) => n - 1);
    }
  }
}
