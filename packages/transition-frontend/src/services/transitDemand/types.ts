/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import TransitOdDemandFromCsv from 'transition-common/lib/services/transitDemand/TransitOdDemandFromCsv';

export type TransitDemandFromCsvFile = {
    type: 'csv';
    demand: TransitOdDemandFromCsv;
    csvFields: string[];
};
