import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterModule } from '@angular/router';

import { LoginData } from '../../models/login-data.model';
import { AuthService } from '../auth.service';

@Component({
    standalone: true,
    imports: [
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        ReactiveFormsModule,
        CommonModule,
        RouterModule
    ],
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent {
    private authService = inject(AuthService);
    public loginForm = new FormGroup({
        email: new FormControl('roro_901@abv.bg', { validators: [Validators.required, Validators.email] }),
        password: new FormControl('roro91_02', { validators: [Validators.required, Validators.minLength(6)] }),
    });

    public onSubmit() {
        if (this.loginForm.value.email && this.loginForm.value.password) {
            const loginData: LoginData = {
                email: this.loginForm.value.email,
                password: this.loginForm.value.password,
            };
            this.authService.login(loginData);
        }
    }
}
