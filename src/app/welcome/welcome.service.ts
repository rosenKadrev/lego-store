import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpContext } from "@angular/common/http";

import { environment } from "../../environments/environment";
import { WelcomeArticle } from "./welcome-models/welcome-article.model";
import { IS_PUBLIC_API } from "../common/constants";

const userServiceUrl: string = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class WelcomeService {
    private http = inject(HttpClient);

    public getArticles() {
        return this.http.get<WelcomeArticle[]>(userServiceUrl + '/articles', {
            context: new HttpContext().set(IS_PUBLIC_API, true)
        });
    }

}