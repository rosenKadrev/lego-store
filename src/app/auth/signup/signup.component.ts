import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { passwordMatchValidator, termsAndConditionsValidator } from '../../common/validators';

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
        CommonModule,
        RouterModule
    ],
    selector: 'app-signup',
    templateUrl: './signup.component.html',
    styleUrls: ['./signup.component.css']
})
export class SignupComponent {
    public maxDate: Date = new Date();

    public signupForm = new FormGroup({
        firstName: new FormControl('', {
            validators: [Validators.required]
        }),
        lastName: new FormControl('', {
            validators: [Validators.required]
        }),
        email: new FormControl('', {
            validators: [Validators.required, Validators.email]
        }),
        gender: new FormControl('', {
            validators: [Validators.required]
        }),
        birthDate: new FormControl('', {
            validators: [Validators.required]
        }),
        passwordGroup: new FormGroup({
            password: new FormControl('', { validators: [Validators.required] }),
            confirmPassword: new FormControl('', { validators: [Validators.required] })
        }, passwordMatchValidator),
        confirmTermsAndConditions: new FormControl(false, { validators: [Validators.required, termsAndConditionsValidator] })
    });

    ngOnInit() {
        this.maxDate.setFullYear(this.maxDate.getFullYear() - 18);
    }

    public onSubmit() {
        console.log(this.signupForm);
    }
}
