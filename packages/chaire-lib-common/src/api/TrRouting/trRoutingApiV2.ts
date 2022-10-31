/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export type TrRoutingV2ResponseCommon = {
    status: 'success';
    origin: [number, number];
    destination: [number, number];
    timeOfTrip: number;
    timeType: 0 | 1;
};

export type TrRoutingV2SummaryResult = TrRoutingV2ResponseCommon & {
    nbAlternativesCalculated: number;
    lines: {
        lineUuid: string;
        lineShortname: string;
        lineLongname: string;
        agencyUuid: string;
        agencyAcronym: string;
        agencyName: string;
        alternativeCount: number;
    }[];
};

export type TrRoutingV2QueryError = {
    status: 'query_error';
    errorCode:
        | 'EMPTY_SCENARIO'
        | 'MISSING_PARAM_SCENARIO'
        | 'MISSING_PARAM_ORIGIN'
        | 'MISSING_PARAM_DESTINATION'
        | 'MISSING_PARAM_TIME_OF_TRIP'
        | 'INVALID_ORIGIN'
        | 'INVALID_DESTINATION'
        | 'INVALID_NUMERICAL_DATA'
        | 'PARAM_ERROR_UNKNOWN';
};

export type TrRoutingV2DataError = {
    status: 'data_error';
    errorCode:
        | 'DATA_ERROR'
        | 'MISSING_DATA_AGENCIES'
        | 'MISSING_DATA_SERVICES'
        | 'MISSING_DATA_NODES'
        | 'MISSING_DATA_LINES'
        | 'MISSING_DATA_PATHS'
        | 'MISSING_DATA_SCENARIOS'
        | 'MISSING_DATA_SCHEDULES';
};

export type TrRoutingV2SummaryResponse = TrRoutingV2SummaryResult | TrRoutingV2DataError | TrRoutingV2QueryError;
