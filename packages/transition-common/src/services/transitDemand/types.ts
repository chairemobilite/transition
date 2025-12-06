import { CsvFileAndMapping } from '../csv';

/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export type TransitDemandFromCsvAttributes = {
    calculationName: string;
    projection: string;
    idAttribute: string;
    timeAttributeDepartureOrArrival: 'arrival' | 'departure';
    timeFormat: string;
    timeAttribute: string;
    csvFile: { location: 'upload'; filename: string } | { location: 'job'; jobId: number };
};

export type TransitDemandFromCsvAccessMapAttributes = TransitDemandFromCsvAttributes & {
    xAttribute: string;
    yAttribute: string;
    // TODO For batch routing, these parameters were moved to batch calculation. They should too for batch access map, when we refactor this calculation a similar way
    withGeometries: boolean;
    calculatePois: boolean;
    detailed: boolean;
    // TODO Remove these from this object once trRouting is parallel
    cpuCount: number;
    maxCpuCount?: number;
};

export type TransitDemandFromCsvRoutingAttributes = {
    projection: string;
    id: string;
    originLat: string;
    originLon: string;
    destinationLat: string;
    destinationLon: string;
    timeType: 'arrival' | 'departure';
    timeFormat: string;
    time: string;
};

export type BatchRoutingOdDemandFromCsvAttributes = CsvFileAndMapping<TransitDemandFromCsvRoutingAttributes>;
