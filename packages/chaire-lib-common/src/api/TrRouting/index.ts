/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as TrRoutingTypes from './base';
import * as TrRoutingV2 from './trRoutingApiV2';

export * from './base';
export * as TrRoutingV2 from './trRoutingApiV2';

export type HostPort = {
    host?: string;
    port?: number;
};

export class TrRoutingConstants {
    /**
     * Socket route name to call a batch routing calculation. It
     * takes a parameter of type {@link TrRoutingTypes.TransitRouteQueryOptions}
     * and will return a {@link Status} with a {@link TrRoutingV2.RouteResponse}
     * on success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly ROUTE = 'service.trRouting.route';
    static readonly ROUTE_V1 = 'service.trRouting.routeV1';
    static readonly UPDATE_CACHE = 'service.trRouting.updateCache';
    /**
     * Socket route name to call a batch routing calculation. It takes
     * parameter of type {@link TransitBatchRoutingDemandAttributes}. It returns a
     * {@link Status}, with a {@link TransitBatchCalculationResult} on success
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
     * of type {@link TransitOdDemandFromCsvAttributes} and a 'csvFields' field
     * containing the string headers of the fields of the csv file on success
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
    /**
     * Relative URL to use when fetching a route request from the server. It
     * takes a parameter of type {@link TrRoutingTypes.TransitRouteQueryOptions}
     * and will return a {@link Status} with a {@link TrRoutingV2.RouteResponse}
     * on success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly FETCH_ROUTE_URL = '/trRouting/route';
    /**
     * Relative URL to use when fetching a route request from the server. It
     * will return a {@link Status} with a
     * {@link TrRoutingTypes.TrRoutingApiResult} on success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly FETCH_ROUTE_V1_URL = '/trRouting/routeV1';
    /**
     * Relative URL to use when fetching a summary request from the server. It
     * will return a {@link Status} with a {@link TrRoutingV2.SummaryResponse} on
     * success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly FETCH_SUMMARY_URL = '/trRouting/summary';
}
