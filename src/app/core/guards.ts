import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../stores/auth.store';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  await auth.whenReady();
  return auth.isLoggedIn() || inject(Router).createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.whenReady();
  if (auth.isAdmin()) return true;
  return auth.isLoggedIn() ? router.createUrlTree(['/']) : router.createUrlTree(['/login'], { queryParams: { redirect: state.url } });
};
