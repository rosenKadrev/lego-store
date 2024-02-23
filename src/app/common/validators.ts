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

export function phoneValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
        const phoneRegex = /^(\+359)\s?8(\d{2}\s\d{3}\d{3}|[789]\d{7})$/;
        const valid = phoneRegex.test(control.value);
        return valid ? null : { 'invalidPhone': true };
    };
}
