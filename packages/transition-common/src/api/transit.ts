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

    /**
     * Socket route name to save transit network design config without running the job.
     * Payload: (jobParameters, existingJobId?: number). Callback: Status<{ jobId: number }>.
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_SAVE_CONFIG = 'service.networkDesign.transit.saveConfig';

    /**
     * Socket route name to start node weighting for a transit network design job
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_START_NODE_WEIGHTING = 'service.networkDesign.transit.startNodeWeighting';

    /**
     * Socket event emitted when node weighting progress is updated
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_PROGRESS =
        'service.networkDesign.transit.nodeWeightingProgress';

    /**
     * Socket event emitted when node weighting completes
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_COMPLETE =
        'service.networkDesign.transit.nodeWeightingComplete';

    /**
     * Socket route name to cancel running node weighting for a job
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_CANCEL_NODE_WEIGHTING = 'service.networkDesign.transit.cancelNodeWeighting';

    /**
     * Socket request to get current node weighting status for a job (running or not, last progress).
     * Used when (re)opening the form so the UI can show running state correctly.
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_STATUS = 'service.networkDesign.transit.nodeWeightingStatus';

    /**
     * Socket request to get node weights file as enriched CSV (uuid, lat, lon, code, name, weight).
     * Callback receives Status<{ csv: string; filename: string }>.
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_GET_NODE_WEIGHTS_FILE = 'service.networkDesign.transit.getNodeWeightsFile';

    /**
     * Socket request to upload a node weights CSV file for a job (alternative to running weighting).
     * Payload: { jobId: number; csvContent: string }. Callback receives Status<unknown>.
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_UPLOAD_NODE_WEIGHTS = 'service.networkDesign.transit.uploadNodeWeights';

    /**
     * Socket request to get total node weight per line for a job (line set, with node weights applied).
     * Payload: jobId (number). Callback receives Status<LineWeightsForJobResponse>.
     * Only available when the job has node_weights.csv (or weighting has been run).
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_GET_LINE_WEIGHTS = 'service.networkDesign.transit.getLineWeights';

    /**
     * Socket request to get line set summary CSV (line_id, shortname, total_weight, total_length_meters,
     * total_cycle_time_seconds) for simple bidirectional lines. Payload: jobId. Callback: Status<{ csv, filename }>.
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_GET_LINE_SET_SUMMARY_CSV =
        'service.networkDesign.transit.getLineSetSummaryCsv';

    /**
     * Server-emitted event during line weights / line set summary load. Payload: { jobId: number; messageKey: string }.
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_LINE_WEIGHTS_PROGRESS = 'service.networkDesign.transit.lineWeightsProgress';

    /**
     * Socket route to continue a completed evolutionary job with additional generations.
     * Payload: { jobId: number; additionalGenerations: number }. Callback: Status<boolean>.
     *
     * @static
     * @memberof TransitApi
     */
    static readonly TRANSIT_NETWORK_DESIGN_CONTINUE = 'service.networkDesign.transit.continue';

    // --- Node weighting (standalone, Nodes section) ---

    static readonly NODE_WEIGHTING_CREATE = 'service.nodeWeighting.create';
    static readonly NODE_WEIGHTING_SAVE_CONFIG = 'service.nodeWeighting.saveConfig';
    static readonly NODE_WEIGHTING_LIST = 'service.nodeWeighting.list';
    static readonly NODE_WEIGHTING_GET_PARAMETERS = 'service.nodeWeighting.getParameters';
    static readonly NODE_WEIGHTING_START = 'service.nodeWeighting.start';
    static readonly NODE_WEIGHTING_CANCEL = 'service.nodeWeighting.cancel';
    static readonly NODE_WEIGHTING_PAUSE = 'service.nodeWeighting.pause';
    static readonly NODE_WEIGHTING_RESUME = 'service.nodeWeighting.resume';
    static readonly NODE_WEIGHTING_STATUS = 'service.nodeWeighting.status';
    static readonly NODE_WEIGHTING_GET_FILE = 'service.nodeWeighting.getFile';
    static readonly NODE_WEIGHTING_UPLOAD = 'service.nodeWeighting.upload';
    static readonly NODE_WEIGHTING_PROGRESS = 'service.nodeWeighting.progress';
    static readonly NODE_WEIGHTING_COMPLETE = 'service.nodeWeighting.complete';
}
