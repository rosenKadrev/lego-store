import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

export type ToastType = 'success' | 'error' | 'info';
export type Toast = { id: number; type: ToastType; text: string };

const DURATION_MS = 4000;
const MAX_VISIBLE = 4;

/** App-wide notifications ("Обявата е създадена" etc.), rendered by <app-toaster>. */
export const ToastStore = signalStore(
  { providedIn: 'root' },
  withState({ toasts: [] as Toast[] }),
  withMethods((store) => {
    let nextId = 0;
    const timers = new Map<number, ReturnType<typeof setTimeout>>();

    function dismiss(id: number): void {
      clearTimeout(timers.get(id));
      timers.delete(id);
      patchState(store, { toasts: store.toasts().filter((t) => t.id !== id) });
    }

    function show(text: string, type: ToastType = 'success'): void {
      const id = ++nextId;
      patchState(store, { toasts: [...store.toasts(), { id, type, text }].slice(-MAX_VISIBLE) });
      // Errors stay a bit longer so they can be read
      timers.set(id, setTimeout(() => dismiss(id), type === 'error' ? DURATION_MS * 2 : DURATION_MS));
    }

    return {
      dismiss,
      success: (text: string) => show(text, 'success'),
      error: (text: string) => show(text, 'error'),
      info: (text: string) => show(text, 'info'),
    };
  }),
);
