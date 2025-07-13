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
    csvFile: { location: 'upload'; filename: string } | { location: 'server'; fromJob: number };
};

export type TransitDemandFromCsvRoutingAttributes = TransitDemandFromCsvAttributes & {
    originXAttribute: string;
    originYAttribute: string;
    destinationXAttribute: string;
    destinationYAttribute: string;
};

export type TransitBatchRoutingDemandAttributes = {
    type: 'csv';
    configuration: TransitDemandFromCsvRoutingAttributes;
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

export type TransitDemandFromCsValidationAttributes = TransitDemandFromCsvRoutingAttributes & {
    agenciesAttributePrefix: string;
    linesAttributePrefix: string;
    tripDateAttribute?: string;
};

export type TransitBatchValidationDemandAttributes = {
    type: 'csv';
    configuration: TransitDemandFromCsValidationAttributes;
};
