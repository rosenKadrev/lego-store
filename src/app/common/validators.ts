import { ValidationErrors, ValidatorFn, AbstractControl } from '@angular/forms';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password');
    const confirmedPassword = control.get('confirmPassword');

    if (password && confirmedPassword && password.value !== confirmedPassword.value) {
        confirmedPassword?.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
    } else {
        confirmedPassword?.setErrors(null);
        return null;
    }
};

export const termsAndConditionsValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const confirmTermsAndConditions = control.value;

    if (!confirmTermsAndConditions) {
        return { termsNotAgreed: true };
    } else {
        return null;
    }
};