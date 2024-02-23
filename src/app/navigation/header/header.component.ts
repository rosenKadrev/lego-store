import { Component, EventEmitter, Output, inject } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Subscription } from 'rxjs';

import { AuthService } from '../../auth/auth.service';

@Component({
    standalone: true,
    imports: [MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule, RouterOutlet, RouterModule, CommonModule],
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
    @Output() sidenavToggle = new EventEmitter<void>();
    private matIconRegistry = inject(MatIconRegistry);
    private domSanitizer = inject(DomSanitizer);
    private router = inject(Router);
    private authService = inject(AuthService);
    public userIsAuth: boolean = false;
    public firstName: string | null = '';
    public authStatusObs$ = this.authService.getAuthStatusListener();
    private authStatusSub: Subscription = new Subscription();

    constructor() {
        this.matIconRegistry.addSvgIcon(
            'lego-logo',
            this.domSanitizer.bypassSecurityTrustResourceUrl('../../../assets/svg/lego-logo.svg')
        );
    }

    ngOnInit() {
        this.userIsAuth = this.authService.getIsAuth();
        this.firstName = this.authService.getUsername();
        this.authStatusSub = this.authStatusObs$.subscribe({
            next: (isAuth) => {
                this.userIsAuth = isAuth;
                if (this.userIsAuth) {
                    this.firstName = this.authService.getUsername();
                } else {
                    this.firstName = null;
                }
            }
        });
    }

    public onToggleSidenav() {
        this.sidenavToggle.emit();
    }

    public onNavigateToWelcome() {
        this.router.navigate(['/']);
    }

    public onLogout() {
        this.authService.logout();
    }

    public onNavigateToShoppingCart() {
        this.router.navigate(['/shopping-cart']);

    }

    ngOnDestroy() {
        this.authStatusSub.unsubscribe();
    }
}
