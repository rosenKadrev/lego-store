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

import { passwordMatchValidator, phoneValidator, termsAndConditionsValidator } from '../../common/validators';
import { AuthService } from '../auth.service';
import { SignupData } from '../auth-models/signup-data.model';

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
        firstName: new FormControl<string>('', { validators: Validators.required }),
        lastName: new FormControl<string>('', { validators: Validators.required }),
        email: new FormControl<string>('', { validators: [Validators.required, Validators.email] }),
        phone: new FormControl<string>('+359', { validators: [Validators.required, phoneValidator()] }),
        gender: new FormControl<string>('', { validators: Validators.required }),
        birthDate: new FormControl<string>('', { validators: Validators.required }),
        passwordGroup: new FormGroup({
            password: new FormControl<string>('', { validators: [Validators.required, Validators.minLength(6)] }),
            confirmPassword: new FormControl<string>('', { validators: [Validators.required, Validators.minLength(6)] })
        }, passwordMatchValidator),
        confirmTermsAndConditions: new FormControl<boolean>(false, { validators: [Validators.required, termsAndConditionsValidator] }),
        role: new FormControl<string>('member', { validators: Validators.required })
    });

    ngOnInit() {
        this.maxDate.setFullYear(this.maxDate.getFullYear() - 18);
    }

    public onSubmit() {
        if (this.signupForm.valid) {
            const newDate = new Date(this.signupForm.value.birthDate as string);
            const utcDate = new Date(Date.UTC(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), 0, 0, 0));
            const stringDate = utcDate.toISOString();
            const signupData: SignupData = {
                firstName: this.signupForm.value.firstName as string,
                lastName: this.signupForm.value.lastName as string,
                email: this.signupForm.value.email as string,
                phone: this.signupForm.value.phone as string,
                gender: this.signupForm.value.gender as string,
                birthDate: stringDate,
                password: this.signupForm.value.passwordGroup!.password as string,
                role: this.signupForm.value.role as string
            };
            this.authService.createUser(signupData);
        }
    }
}
