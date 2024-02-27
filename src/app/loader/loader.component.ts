import { Component, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoaderService } from './loader.service';
import { BehaviorSubject } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
    standalone: true,
    imports: [MatProgressSpinnerModule, CommonModule],
    selector: 'app-loader',
    templateUrl: './loader.component.html',
    styleUrls: ['./loader.component.scss']
})
export class LoaderComponent {
    private loaderService = inject(LoaderService);
    public isLoading: BehaviorSubject<boolean> = this.loaderService.isLoading;
}
