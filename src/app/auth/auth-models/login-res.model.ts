export interface LoginRes {
    message: string;
    response: Response;
}

interface Response {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: string;
    token: string;
    expiresIn: number;
}
