import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CommonModule } from '@angular/common';

import { passwordMatchValidator, termsAndConditionsValidator } from '../../common/validators';
import { SignupData } from '../../models/signup-data.model';
import { AuthService } from '../auth.service';

@Component({
    standalone: true,
    imports: [
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatCheckboxModule,
        ReactiveFormsModule,
        CommonModule
    ],
    selector: 'app-signup',
    templateUrl: './signup.component.html',
    styleUrls: ['./signup.component.scss']
})
export class SignupComponent {
    private authService = inject(AuthService);
    public maxDate: Date = new Date();

    public signupForm = new FormGroup({
        firstName: new FormControl('', { validators: Validators.required }),
        lastName: new FormControl('', { validators: Validators.required }),
        email: new FormControl('', { validators: [Validators.required, Validators.email] }),
        phone: new FormControl('', { validators: Validators.required }),
        gender: new FormControl('', { validators: Validators.required }),
        birthDate: new FormControl('', { validators: Validators.required }),
        passwordGroup: new FormGroup({
            password: new FormControl('', { validators: [Validators.required, Validators.minLength(6)] }),
            confirmPassword: new FormControl('', { validators: [Validators.required, Validators.minLength(6)] })
        }, passwordMatchValidator),
        confirmTermsAndConditions: new FormControl(false, { validators: [Validators.required, termsAndConditionsValidator] }),
        role: new FormControl('member', { validators: Validators.required })
    });

    ngOnInit() {
        this.maxDate.setFullYear(this.maxDate.getFullYear() - 18);
    }

    public onSubmit() {
        console.log(this.signupForm.value);
        // if (this.signupForm.value.firstName && this.signupForm.value.lastName && this.signupForm.value.email && this.signupForm.value.gender && this.signupForm.value.birthDate && this.signupForm.value.passwordGroup?.password) {
        // const signupData: SignupData = {
        //     firstName: this.signupForm.value.firstName,
        //     lastName: this.signupForm.value.lastName,
        //     email: this.signupForm.value.email,
        //     gender: this.signupForm.value.gender,
        //     birthDate: this.signupForm.value.birthDate,
        //     password: this.signupForm.value.passwordGroup.password
        // };
        // this.authService.createUser(signupData);
        // }
    }
}
