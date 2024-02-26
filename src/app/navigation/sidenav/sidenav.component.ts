import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { AuthService } from '../../auth/auth.service';

@Component({
    standalone: true,
    imports: [MatSidenavModule, MatIconModule, MatListModule, RouterModule, CommonModule],
    selector: 'app-sidenav',
    templateUrl: './sidenav.component.html',
    styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent {
    @Output() closeSidenav = new EventEmitter<void>();
    private authService = inject(AuthService);
    public userIsAuth: boolean = false;
    public authStatusObs$ = this.authService.getAuthStatusListener();
    private authStatusSub: Subscription = new Subscription();

    ngOnInit() {
        this.userIsAuth = this.authService.getIsAuth();
        this.authStatusSub = this.authStatusObs$.subscribe({
            next: (isAuth) => {
                this.userIsAuth = isAuth;
            }
        });
    }

    public onClose() {
        this.closeSidenav.emit();
    }

    public onLogout() {
        this.onClose();
        this.authService.logout();
    }

    ngOnDestroy() {
        this.authStatusSub.unsubscribe();
    }
}
