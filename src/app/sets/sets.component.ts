import { CommonModule } from '@angular/common';
import { Component, SimpleChanges, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SetsService } from './sets.service';

@Component({
    standalone: true,
    imports: [CommonModule, MatPaginatorModule, MatCardModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule, MatCheckboxModule, FormsModule, ReactiveFormsModule],
    selector: 'app-sets',
    templateUrl: './sets.component.html',
    styleUrls: ['./sets.component.scss']
})
export class SetsComponent {
    private router = inject(Router);
    private setsService = inject(SetsService);
    public currentPage: number = 1;
    public pageIndex: number = 0;
    public previousPageIndex: number = 0;
    public setsPerPage: number = 12;
    public pageSizeOptions: number[] = [12, 24, 48, 96];
    public setsRes$ = this.setsService.getSets(this.setsPerPage, this.currentPage);
    public selectValues$ = this.setsService.getSelectValues();
    public activeFilters: any;
    public filterForm = new FormGroup({
        themeFilter: new FormControl(null),
        subthemeFilter: new FormControl({ value: null, disabled: true }),
        yearFilter: new FormControl(null)
    });

    ngOnInit() {
        this.filterForm
            .valueChanges
            .subscribe(
                res => console.log(res)
            );
    }


    public onChangedPage(event: PageEvent) {
        if (event.pageSize != this.setsPerPage) {
            this.setsPerPage = event.pageSize;
            this.currentPage = 1;
            this.pageIndex = 0;
        } else if (!event.previousPageIndex || (event.pageIndex > event.previousPageIndex)) {
            this.currentPage ++;
            this.pageIndex ++;
        } else if (event.pageIndex < event.previousPageIndex){
            this.currentPage --;
            this.pageIndex --;
        }
        this.setsRes$ = this.setsService.getSets(this.setsPerPage, this.currentPage);
    }

    public onNavigateToSet(id: string) {
        this.router.navigate([`/sets/${id}`]);
    }

    public onSubmit() {

    }
}

