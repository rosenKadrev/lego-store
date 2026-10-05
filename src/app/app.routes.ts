import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards';
import { Home } from './pages/home';

export const routes: Routes = [
  { path: '', component: Home, title: 'MBRBrickStore — нови и употребявани LEGO® сетове' },
  { path: 'catalog', loadComponent: () => import('./pages/catalog').then((m) => m.Catalog) },
  { path: 'themes', loadComponent: () => import('./pages/themes').then((m) => m.Themes), title: 'Всички теми | MBRBrickStore' },
  { path: 'p/:slug', loadComponent: () => import('./pages/product').then((m) => m.Product) },
  { path: 'cart', loadComponent: () => import('./pages/cart').then((m) => m.Cart), title: 'Количка | MBRBrickStore' },
  { path: 'checkout', loadComponent: () => import('./pages/checkout').then((m) => m.Checkout), title: 'Поръчка | MBRBrickStore' },
  {
    path: 'order/:number',
    loadComponent: () => import('./pages/order-success').then((m) => m.OrderSuccess),
    title: 'Благодарим! | MBRBrickStore',
  },
  { path: 'login', loadComponent: () => import('./pages/auth/login').then((m) => m.Login), title: 'Вход | MBRBrickStore' },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register').then((m) => m.Register),
    title: 'Регистрация | MBRBrickStore',
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/auth/forgot-password').then((m) => m.ForgotPassword),
    title: 'Забравена парола | MBRBrickStore',
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/auth/reset-password').then((m) => m.ResetPassword),
    title: 'Нова парола | MBRBrickStore',
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account').then((m) => m.Account),
    title: 'Моят профил | MBRBrickStore',
  },
  { path: 'info/:page', loadComponent: () => import('./pages/info').then((m) => m.Info) },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin/admin-layout').then((m) => m.AdminLayout),
    title: 'Админ | MBRBrickStore',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'orders' },
      { path: 'orders', loadComponent: () => import('./admin/admin-orders').then((m) => m.AdminOrders) },
      { path: 'listings', loadComponent: () => import('./admin/admin-listings').then((m) => m.AdminListings) },
      { path: 'listings/new', loadComponent: () => import('./admin/listing-form').then((m) => m.ListingForm) },
      { path: 'listings/:id', loadComponent: () => import('./admin/listing-form').then((m) => m.ListingForm) },
    ],
  },
  { path: '**', loadComponent: () => import('./pages/not-found').then((m) => m.NotFound), title: 'Няма такава страница' },
];
