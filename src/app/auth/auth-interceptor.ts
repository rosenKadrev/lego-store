import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { finalize } from "rxjs";

import { AuthService } from "./auth.service";
import { LoaderService } from "../loader/loader.service";
import { IS_PUBLIC_API } from "../common/constants";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const loaderService = inject(LoaderService);
    const authToken = authService.getToken();
    loaderService.show();
    if (req.context.get(IS_PUBLIC_API)) {
        return next(req).pipe(
            finalize(() => loaderService.hide())
        );
    }
    const authReq = req.clone({
        headers: req.headers.set('Authorization', 'Bearer ' + authToken)
    });
    return next(authReq).pipe(
        finalize(() => loaderService.hide())
    );
}