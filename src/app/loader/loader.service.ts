import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoaderService {

    public isLoading = new BehaviorSubject<boolean>(false);

    public show() {
        this.isLoading.next(true);
    }

    public hide() {
        this.isLoading.next(false);
    }
}