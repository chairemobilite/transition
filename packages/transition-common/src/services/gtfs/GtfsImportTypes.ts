/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';

import { ServiceAttributes } from '../service/Service';

export interface GtfsAgency extends GtfsTypes.Agency {
    // Make the agency ID required for the Gtfs import
    agency_id: string;
    tr_agency_description?: string;
    tr_agency_color?: string;
}

export interface GtfsRoute extends GtfsTypes.Route {
    // Make the agency ID required for the Gtfs import
    agency_id: string;
    tr_route_internal_id?: string;
    tr_route_row_category?: string;
    tr_is_autonomous?: string;
    tr_allow_same_route_transfers?: string;
}

export interface GtfsStop extends GtfsTypes.Stop {
    // Make the lat/lon required for Gtfs import (other stops will be ignored)
    stop_lat: number;
    stop_lon: number;
    location_type: GtfsTypes.LocationType;
    tr_node_color?: string;
    tr_routing_radius_meters?: number;
    tr_default_dwell_time_seconds?: number;
    tr_can_be_used_as_terminal?: boolean;
}

export interface AgencyImportData {
    /**
     * Agency GTFS data
     *
     * @type {GtfsAgency}
     * @memberof AgencyImportData
     */
    agency: GtfsAgency;
    /**
     * An array of existing agencies that match the agency in the GTFS
     *
     * @type {{id: string; acronym: string;
     *     }}
     * @memberof AgencyImportData
     */
    existingAgencies: {
        id: string;
        acronym: string;
    }[];
    /**
     * Action to execute when agencies with the same ID exist. The agency ID
     * field corresponds to the agency on which to perform the action, ie an
     * existing one for replace and merge and the new name for a new agency.
     *
     * @type {({action: 'replace' | 'merge' | 'create', agencyId: string
     *     })}
     * @memberof AgencyImportData
     */
    agencyAction?: {
        action: 'replace' | 'mergeAndIgnore' | 'mergeAndReplace' | 'create';
        agencyId: string;
    };
    selected?: boolean;
}

export interface LineImportData {
    /**
     * Line GTFS data
     *
     * @type {GtfsRoute}
     * @memberof LineImportData
     */
    line: GtfsRoute;
    selected?: boolean;
}

export interface ServiceImportData {
    service: Partial<ServiceAttributes>;
    selected?: boolean;
}

export interface StopImportData {
    stop: GtfsStop;
}

export interface GtfsImportData {
    agencies: AgencyImportData[];
    lines: LineImportData[];
    services: ServiceImportData[];
    stopAggregationWalkingRadiusSeconds?: number;
    periodsGroupShortname?: string;
    periodsGroup?: any;
    agencies_color?: string;
    nodes_color?: string;
    mergeSameDaysServices?: boolean;
    generateFrequencyBasedSchedules?: boolean;
}
