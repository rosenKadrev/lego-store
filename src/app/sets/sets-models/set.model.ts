export interface SetsRes {
    sets: Set[];
    totalCount: number;
}

export interface Set {
    id: string;
    name: string;
    number: number;
    theme: string;
    subtheme: string;
    ageRange?: number;
    yearReleased: number;
    launch?: string;
    exit?: string;
    pieces: number;
    priceNew: number;
    priceUsed?: number;
    minifigs?: number;
    mainImgUrl: string;
    imgUrls?: string;
}