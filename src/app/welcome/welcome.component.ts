import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { WelcomeService } from './welcome.service';

@Component({
    standalone: true,
    imports: [MatCardModule, MatButtonModule, CommonModule],
    selector: 'app-welcome',
    templateUrl: './welcome.component.html',
    styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent {
    public articles$ = inject(WelcomeService).getArticles();
}
