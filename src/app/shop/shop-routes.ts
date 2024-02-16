import { Route } from "@angular/router";
import { ShopComponent } from "./shop.component";
import { ShopItemComponent } from "./shop-item/shop-item.component";



export const SHOP_ROUTES: Route[] = [
    {
        path: '',
        component: ShopComponent
    },
    {
        path: ':id',
        component: ShopItemComponent
    }
];