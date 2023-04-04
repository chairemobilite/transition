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
    withGeometries: boolean;
    detailed: boolean;
    cpuCount: number;
    csvFile: { location: 'upload'; filename: string } | { location: 'server'; fromJob: number };
};

export type TransitDemandFromCsvRoutingAttributes = TransitDemandFromCsvAttributes & {
    originXAttribute: string;
    originYAttribute: string;
    destinationXAttribute: string;
    destinationYAttribute: string;
    saveToDb: false | { type: 'new'; dataSourceName: string } | { type: 'overwrite'; dataSourceId: string };
};

export type TransitBatchRoutingDemandAttributes = {
    type: 'csv';
    configuration: TransitDemandFromCsvRoutingAttributes;
};

export type TransitDemandFromCsvAccessMapAttributes = TransitDemandFromCsvAttributes & {
    xAttribute: string;
    yAttribute: string;
};
