import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { Observable, Subscription } from 'rxjs';

import { WelcomeService } from './welcome.service';
import { WelcomeArticle } from '../models/welcome-article.model';

@Component({
    standalone: true,
    imports: [MatCardModule, MatButtonModule, CommonModule],
    selector: 'app-welcome',
    templateUrl: './welcome.component.html',
    styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent {
    private welcomeService = inject(WelcomeService);
    public articles: WelcomeArticle[] = [];
    private articlesObs$?: Observable<WelcomeArticle[]>;
    private articlesSub: Subscription = new Subscription();

    ngOnInit() {
        this.articlesObs$ = this.welcomeService.getArticles();
        this.articlesSub = this.articlesObs$.subscribe({
            next: (res) => {
                this.articles = res;
                console.log(this.articles);
            }, error: () => {

            }
        });
    }

    ngOnDestroy() {
        this.articlesSub.unsubscribe();
    }
}
