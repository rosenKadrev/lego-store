import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { Session } from '@supabase/supabase-js';
import { Profile } from '../core/models';
import { Supabase } from '../core/supabase';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  initialized: boolean;
};

export type SignUpData = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

/** Translates the most common Supabase Auth errors for the UI. */
function authErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Грешен имейл или парола.';
  if (/already registered/i.test(message)) return 'Вече има регистрация с този имейл.';
  if (/email not confirmed/i.test(message)) return 'Потвърдете имейла си от линка, който ви изпратихме.';
  if (/password should be at least/i.test(message)) return 'Паролата трябва да е поне 8 символа.';
  if (/auth session missing|session.*expired/i.test(message)) return 'Линкът е изтекъл. Поискайте нов.';
  return message;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({ session: null, profile: null, initialized: false }),
  withComputed(({ session, profile }) => ({
    user: computed(() => session()?.user ?? null),
    isLoggedIn: computed(() => !!session()),
    isAdmin: computed(() => profile()?.role === 'admin'),
    displayName: computed(() => {
      const name = profile()?.full_name?.trim();
      return name ? name.split(/\s+/)[0] : (session()?.user.email?.split('@')[0] ?? '');
    }),
  })),
  withMethods((store, supabase = inject(Supabase)) => {
    const db = supabase.client;
    let ready: Promise<void> | null = null;

    async function loadProfile(): Promise<void> {
      const userId = store.session()?.user.id;
      if (!userId) {
        patchState(store, { profile: null });
        return;
      }
      const { data } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
      patchState(store, { profile: data });
    }

    return {
      /** Resolves once the persisted session (if any) and the profile are loaded. */
      whenReady(): Promise<void> {
        ready ??= (async () => {
          const { data } = await db.auth.getSession();
          patchState(store, { session: data.session });
          await loadProfile();
          patchState(store, { initialized: true });

          db.auth.onAuthStateChange((event, session) => {
            const changedUser = session?.user.id !== store.session()?.user.id;
            patchState(store, { session });
            // Don't await Supabase calls inside this callback (it holds the auth lock)
            if (changedUser || event === 'USER_UPDATED') setTimeout(() => void loadProfile());
          });
        })();
        return ready;
      },

      async signIn(email: string, password: string): Promise<string | null> {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) return authErrorMessage(error.message);
        patchState(store, { session: data.session });
        await loadProfile();
        return null;
      },

      /** Returns `{ needsConfirmation: true }` when email confirmation is enabled. */
      async signUp(form: SignUpData): Promise<{ error: string | null; needsConfirmation: boolean }> {
        const { data, error } = await db.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName, phone: form.phone },
            emailRedirectTo: `${location.origin}/account`,
          },
        });
        if (error) return { error: authErrorMessage(error.message), needsConfirmation: false };
        patchState(store, { session: data.session });
        await loadProfile();
        return { error: null, needsConfirmation: !data.session };
      },

      /** Sends a reset link. Succeeds for unknown emails too, so accounts can't be probed. */
      async requestPasswordReset(email: string): Promise<string | null> {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/reset-password`,
        });
        if (error && /rate limit|too many/i.test(error.message)) {
          return 'Твърде много опити. Опитайте отново след няколко минути.';
        }
        return error ? authErrorMessage(error.message) : null;
      },

      /** Sets a new password for the current session (opened from the reset link, or logged in). */
      async updatePassword(password: string): Promise<string | null> {
        const { error } = await db.auth.updateUser({ password });
        if (!error) return null;
        if (/different from the old/i.test(error.message)) return 'Новата парола трябва да е различна от старата.';
        return authErrorMessage(error.message);
      },

      async signOut(): Promise<void> {
        await db.auth.signOut();
        patchState(store, { session: null, profile: null });
      },

      async updateProfile(changes: Pick<Profile, 'full_name' | 'phone'>): Promise<string | null> {
        const userId = store.session()?.user.id;
        if (!userId) return 'Не сте влезли в профила си.';
        const { data, error } = await db.from('profiles').update(changes).eq('id', userId).select().single();
        if (error) return error.message;
        patchState(store, { profile: data });
        return null;
      },
    };
  }),
  withHooks({
    onInit(store) {
      void store.whenReady();
    },
  }),
);
