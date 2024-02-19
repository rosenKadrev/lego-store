import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
    standalone: true,
    imports: [CommonModule,],
    selector: 'app-sets',
    templateUrl: './sets.component.html',
    styleUrls: ['./sets.component.css']
})
export class SetsComponent {
    private router = inject(Router);
    public items = [{ id: '2577e871-c54c-494c-8af5-218f07a24bd5', name: 'Set 1' }, { id: '1e4c0205-54c8-4aa2-8768-c50694227b2c', name: 'Set 2' }, { id: '36d6b1f0-4a78-42e0-83d1-742e715dfc04', name: 'Set 3' }];

    public onNavigateToSet(id: string) {
        this.router.navigate([`/sets/${id}`]);
    }
}
