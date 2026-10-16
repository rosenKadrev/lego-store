import { computed, Injectable, signal } from '@angular/core';

/**
 * Work the user has to wait for before doing anything else (saving, importing, uploading…).
 * While anything is tracked here BusyOverlay covers the page, so nothing else can be clicked.
 */
@Injectable({ providedIn: 'root' })
export class Busy {
  private readonly jobs = signal<{ id: number; label: string }[]>([]);
  private nextId = 0;

  readonly active = computed(() => this.jobs().length > 0);
  /** Label of the most recent job, shown under the spinner */
  readonly label = computed(() => this.jobs().at(-1)?.label ?? '');

  async track<T>(work: PromiseLike<T> | (() => PromiseLike<T>), label = 'Моля, изчакайте…'): Promise<T> {
    const id = ++this.nextId;
    this.jobs.update((jobs) => [...jobs, { id, label }]);
    try {
      return await (typeof work === 'function' ? work() : work);
    } finally {
      this.jobs.update((jobs) => jobs.filter((j) => j.id !== id));
    }
  }
}
