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

    public kurs = [{ id: 'fdfdfdfdfdfdf', name: 'kur' }, { id: 'fdfdfdfdgdfdf', name: 'kur1' }, { id: 'fdfdfd3dfdfdf', name: 'kur2' }];

    onKur(id: string) {
        console.log(id);
        this.router.navigate([`/sets/${id}`]);

    }
}
