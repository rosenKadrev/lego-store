import { Injectable, inject } from "@angular/core";
import { Router } from '@angular/router';
import { HttpClient } from "@angular/common/http";

import { SignupData } from "../models/signup-data.model";
import { environment } from "../../environments/environment";

const userServiceUrl: string = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
    private router = inject(Router);
    private http = inject(HttpClient);

    public createUser(signupData: SignupData) {
        this.http.post(userServiceUrl + '/signup', signupData).subscribe(res => {
            this.router.navigate(['/']);
        }, error => {
            // this.authStatusListener.next(false);
        });
    }

}