import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { environment } from "../../environments/environment";
import { WelcomeArticle } from "./welcome-models/welcome-article.model";

const userServiceUrl: string = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class WelcomeService {
    private http = inject(HttpClient);

    public getArticles() {
        return this.http.get<WelcomeArticle[]>(userServiceUrl + '/articles');
    }

}