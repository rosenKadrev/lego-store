import { Injectable, inject } from "@angular/core";
import { Router } from '@angular/router';
import { HttpClient } from "@angular/common/http";

import { SignupData } from "../models/signup-data.model";
import { environment } from "../../environments/environment";
import { Subject } from "rxjs";
import { LoginData } from "../models/login-data.model";
import { LoginRes } from "../models/login-res.model";

const userServiceUrl: string = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
    private isAuth: boolean = false;
    private token: string | null = '';
    private tokenTimer: any;
    private firstName: string | null = '';
    private userId: string | null = '';
    private router = inject(Router);
    private http = inject(HttpClient);
    private authStatusListener = new Subject<boolean>();

    public getToken() {
        return this.token;
    }

    public getIsAuth() {
        return this.isAuth;
    }

    public getAuthStatusListener() {
        return this.authStatusListener.asObservable();
    }

    public getUsername() {
        return this.firstName;
    }

    public createUser(signupData: SignupData) {
        this.http.post(userServiceUrl + '/signup', signupData).subscribe({
            next: () => {
                this.router.navigate(['/login']);
            }, error: () => {
                this.authStatusListener.next(false);
            }
        });
    }

    public login(loginData: LoginData) {
        this.http.post<LoginRes>(userServiceUrl + '/login', loginData).subscribe({
            next: (res) => {
                this.token = res.response.token;
                if (res.response.token) {
                    const expiresInDuration = res.response.expiresIn;
                    this.setAuthTimer(expiresInDuration);
                    this.isAuth = true;
                    this.userId = res.response.id;
                    this.firstName = res.response.firstName;
                    this.authStatusListener.next(true);
                    const now = new Date();
                    const expirationDate = new Date(now.getTime() + expiresInDuration * 1000);
                    this.saveAuthData(this.token, expirationDate, this.userId, this.firstName);
                    this.router.navigate(['/']);
                }
            }, error: () => {
                this.authStatusListener.next(false);
            }
        });
    }

    public autoAuthUser() {
        const authInfo = this.getAuthDAta();
        if (!authInfo) {
            return;
        }
        const now = new Date();
        const expiresIn = authInfo.expirationDate.getTime() - now.getTime();
        if (expiresIn > 0) {
            this.token = authInfo.token;
            this.isAuth = true;
            this.userId = authInfo.userId;
            this.firstName = authInfo.firstName;

            this.setAuthTimer(expiresIn / 1000);
            this.authStatusListener.next(true);
        }
    }

    public logout() {
        this.token = null;
        this.isAuth = false;
        this.authStatusListener.next(false);
        clearTimeout(this.tokenTimer);
        this.clearAuthData();
        this.userId = null;
        this.router.navigate(['/']);
    }

    private setAuthTimer(duration: number) {
        this.tokenTimer = setTimeout(() => {
            this.logout();
        }, duration * 1000);
    }

    private saveAuthData(token: string, expirationDate: Date, userId: string, firstName: string) {
        localStorage.setItem('token', token);
        localStorage.setItem('expiration', expirationDate.toISOString());
        localStorage.setItem('userId', userId);
        localStorage.setItem('firstName', firstName);
    }

    private clearAuthData() {
        localStorage.removeItem('token');
        localStorage.removeItem('expiration');
        localStorage.removeItem('userId');
        localStorage.removeItem('firstName');
    }

    private getAuthDAta() {
        const token = localStorage.getItem('token');
        const expirationDate = localStorage.getItem('expiration');
        const userId = localStorage.getItem('userId');
        const firstName = localStorage.getItem('firstName');
        if (!token || !expirationDate) {
            return;
        }
        return {
            token: token,
            expirationDate: new Date(expirationDate),
            userId: userId,
            firstName: firstName
        }
    }

}