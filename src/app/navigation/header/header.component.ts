import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterModule, RouterOutlet } from '@angular/router';

@Component({
    standalone: true,
    imports: [MatToolbarModule, MatIconModule, MatButtonModule, RouterOutlet, RouterModule],
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
    @Output() sidenavToggle = new EventEmitter<void>();
    private matIconRegistry = inject(MatIconRegistry);
    private domSanitizer = inject(DomSanitizer);
    private router = inject(Router);

    constructor() {
        this.matIconRegistry.addSvgIcon(
            'lego-logo',
            this.domSanitizer.bypassSecurityTrustResourceUrl('../../../assets/svg/lego-logo.svg')
        );
    }

    public onToggleSidenav() {
        this.sidenavToggle.emit();
    }

    public onNavigateToWelcome() {
        this.router.navigate(['/']);
    }

    public onLogout() {
        // this.authService.logout();
        this.router.navigate(['/']);
    }
}
