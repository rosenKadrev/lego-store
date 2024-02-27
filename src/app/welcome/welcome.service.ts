import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpContext, HttpContextToken } from "@angular/common/http";

import { environment } from "../../environments/environment";
import { WelcomeArticle } from "./welcome-models/welcome-article.model";

export const IS_PUBLIC_API_WELCOME = new HttpContextToken<boolean>(() => false);
const userServiceUrl: string = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class WelcomeService {
    private http = inject(HttpClient);

    public getArticles() {
        return this.http.get<WelcomeArticle[]>(userServiceUrl + '/articles', {
            context: new HttpContext().set(IS_PUBLIC_API_WELCOME, true)
        });
    }

}