import { Route } from "@angular/router";

import { SetsComponent } from "./sets.component";
import { SetComponent } from "./set/set.component";


export const SETS_ROUTES: Route[] = [
    {
        path: '',
        component: SetsComponent
    },
    {
        path: ':id',
        component: SetComponent
    }
];