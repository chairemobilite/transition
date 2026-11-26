/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
import * as TrRoutingTypes from './base';
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
import * as TrRoutingV2 from './trRoutingApiV2';

export * from './base';
export * as TrRoutingV2 from './trRoutingApiV2';

export type HostPort = {
    host?: string;
    port?: number;
};

export class TrRoutingConstants {
    /**
     * Socket route name to call a batch routing calculation. It takes the
     * demand, of type {@link BatchRoutingOdDemandFromCsvAttributes}, the routing
     * parameters, of type {@link BatchCalculationParameters}, and an object with
     * the optional 'name' of the job to create. It returns a {@link Status},
     * with a {@link TransitBatchCalculationResult} on success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly BATCH_ROUTE = 'service.trRouting.batchRoute';
    /**
     * Socket route name to call to get the parameters to replay a previously
     * saved task. It takes the ID of the batch routing job to replay. It
     * returns a {@link Status}, with a object containing a field named
     * 'parameters' of type {@link BatchCalculationParameters}, a 'demand' field
     * of type {@link BatchRoutingOdDemandFromCsvAttributes}, a 'csvFields' field
     * containing the string headers of the fields of the csv file and a 'name'
     * field with the name of the job, undefined when the job has none, on
     * success
     *
     * TODO Move batch route related services and constants to transition-backend
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly BATCH_ROUTE_REPLAY = 'service.trRouting.batchRouteReplay';
    /**
     * Socket route name to call a batch accessibility map calculation. It takes
     * a parameter of type {@link TransitDemandFromCsvAccessMapAttributes}. It
     * returns a {@link Status}, with a {@link TransitBatchCalculationResult} on
     * success.
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly BATCH_ACCESS_MAP = 'service.trRouting.batchAccessMap';
}
