import { Routes, RouterModule } from '@angular/router';
import { authGuard } from './auth/auth-guard';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./welcome/welcome.component').then((mod) => mod.WelcomeComponent)

    },
    {
        path: 'login',
        loadComponent: () => import('./auth/login/login.component').then((mod) => mod.LoginComponent)
    },
    {
        path: 'signup',
        loadComponent: () => import('./auth/signup/signup.component').then((mod) => mod.SignupComponent)
    },
    {
        path: 'shop',
        loadChildren: () =>
            import('./shop/shop-routes').then(
                (mod) => mod.SHOP_ROUTES
            ),
        canActivate: [authGuard]
    },
    {
        path: 'sets',
        loadChildren: () =>
            import('./sets/sets-routes').then(
                (mod) => mod.SETS_ROUTES
            )
    },
    {
        path: 'my-sets',
        loadComponent: () => import('./my-sets/my-sets.component').then((mod) => mod.MySetsComponent),
        canActivate: [authGuard]
    },
    {
        path: 'shopping-cart',
        loadComponent: () => import('./shopping-cart/shopping-cart.component').then((mod) => mod.ShoppingCartComponent),
        canActivate: [authGuard]
    },
];
export const AppRoutingModule = RouterModule.forRoot(routes);