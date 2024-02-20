import { Component, EventEmitter, Output } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';


@Component({
    standalone: true,
    imports: [MatSidenavModule, MatIconModule, MatListModule, RouterModule],
    selector: 'app-sidenav',
    templateUrl: './sidenav.component.html',
    styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent {
    @Output() closeSidenav = new EventEmitter<void>();

    public onClose() {
        this.closeSidenav.emit();
    }

    public onLogout() {
        this.onClose();
    }
}
