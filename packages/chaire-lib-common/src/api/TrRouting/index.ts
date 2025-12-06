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
     * Socket route name to call a batch routing calculation. It
     * takes a parameter of type {@link TrRoutingTypes.TransitRouteQueryOptions}
     * and will return a {@link Status} with a {@link TrRoutingV2.RouteResponse}
     * on success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly ROUTE = 'service.trRouting.route';
    /**
     * Socket route name to call a batch routing calculation. It takes parameter
     * of type {@link BatchRoutingOdDemandFromCsvAttributes}. It returns a
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
     * of type {@link BatchRoutingOdDemandFromCsvAttributes} and a 'csvFields' field
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
     * Relative URL to use when fetching a summary request from the server. It
     * will return a {@link Status} with a {@link TrRoutingV2.SummaryResponse} on
     * success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly FETCH_SUMMARY_URL = '/trRouting/summary';
    /**
     * Socket route name to call an accessibility map calculation. It
     * takes a parameter of type {@link TrRoutingTypes.AccessibilityMapQueryOptions}
     * and will return a {@link Status} with a {@link TrRoutingV2.AccessibilityMapResponse}
     * on success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly ACCESSIBILITY_MAP = 'service.trRouting.accessibilityMap';
    /**
     * Relative URL to use when fetching an accessibility map request from the
     * server. It takes a parameter of type
     * {@link TrRoutingTypes.AccessibilityMapQueryOptions} and will return a
     * {@link Status} with a {@link TrRoutingV2.AccessibilityMapResponse} on success
     *
     * @static
     * @memberof TrRoutingConstants
     */
    static readonly FETCH_ACCESSIBILITY_MAP_URL = '/trRouting/accessibilityMap';
}
