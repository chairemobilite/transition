/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export class TransitApi {
    /**
     * Socket route name to delete the unused transit nodes
     *
     * @static
     * @memberof TransitApi
     */
    static readonly DELETE_UNUSED_NODES = 'transitNodes.deleteUnused';

    /**
     * Socket route name to create and execute a transit network design job
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_CREATE = 'service.networkDesign.transit.create';

    /**
     * Socket route name to replay a transit network design job
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_REPLAY = 'service.networkDesign.transit.replay';
}
