import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';

import { MySetsOwnComponent } from './my-sets-own/my-sets-own.component';
import { MySetsWantComponent } from './my-sets-want/my-sets-want.component';

@Component({
    standalone: true,
    imports: [MatTabsModule, MySetsOwnComponent, MySetsWantComponent],
    selector: 'app-my-sets',
    templateUrl: './my-sets.component.html',
    styleUrls: ['./my-sets.component.scss']
})
export class MySetsComponent { }
