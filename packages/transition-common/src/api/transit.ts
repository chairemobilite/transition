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

    // Node accessibility weighting (standalone, Nodes section)
    static readonly NODE_ACCESSIBILITY_WEIGHTING_CREATE = 'service.nodeAccessibilityWeighting.create';
    static readonly NODE_ACCESSIBILITY_WEIGHTING_DUPLICATE = 'service.nodeAccessibilityWeighting.duplicate';
    static readonly NODE_ACCESSIBILITY_WEIGHTING_LIST = 'service.nodeAccessibilityWeighting.list';
    static readonly NODE_ACCESSIBILITY_WEIGHTING_GET_PARAMETERS = 'service.nodeAccessibilityWeighting.getParameters';
    static readonly NODE_ACCESSIBILITY_WEIGHTING_START = 'service.nodeAccessibilityWeighting.start';
    // Cancel, pause, and resume use the generic JobsConstants routes
    static readonly NODE_ACCESSIBILITY_WEIGHTING_STATUS = 'service.nodeAccessibilityWeighting.status';
    static readonly NODE_ACCESSIBILITY_WEIGHTING_GET_FILE = 'service.nodeAccessibilityWeighting.getFile';
    static readonly NODE_ACCESSIBILITY_WEIGHTING_UPLOAD_INPUT = 'service.nodeAccessibilityWeighting.uploadInput';
}
