import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { environment } from "../../environments/environment";
import { DistinctSelectValues } from "./sets-models/distinct-select-values.model";
import { SetsRes } from "./sets-models/set.model";

const userServiceUrl: string = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class SetsService {
    private http = inject(HttpClient);

    public getSets(setsPerPage: number, currentPage: number) {
        const params = { setsPerPage, currentPage }
        return this.http.get<SetsRes>(userServiceUrl + '/sets', { params });
    }

    public getSelectValues() {
        return this.http.get<DistinctSelectValues>(userServiceUrl + '/distinct_select_values');
    }
}