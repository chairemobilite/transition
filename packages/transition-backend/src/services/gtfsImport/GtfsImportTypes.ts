/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as GtfsTypes from 'gtfs-types';

/*
 * This file contains types used by the GTFS import, but that are required only
 * during import and should never be shown to the user.
 * */

export interface ShapeImportData {
    [key: string]: GtfsTypes.Shapes[];
}

export interface StopTime extends GtfsTypes.StopTime {
    arrivalTimeSeconds: number;
    departureTimeSeconds: number;
}

export interface StopTimeImportData {
    [key: string]: StopTime[];
}

export interface Frequencies extends GtfsTypes.Frequencies {
    startTimeSeconds: number;
    endTimeSeconds: number;
}

export interface FrequencyImportData {
    [key: string]: Frequencies[];
}

// TODO The GTFS import periods are from the preferences? This type should then be somewhere else?
export interface Period {
    endAtHour: number;
    name: { [key: string]: string };
    shortname: string;
    startAtHour: number;
}

export interface GtfsInternalData {
    agencyIdsByAgencyGtfsId: { [key: string]: string };
    lineIdsByRouteGtfsId: { [key: string]: string };
    serviceIdsByGtfsId: { [key: string]: string };
    nodeIdsByStopGtfsId: { [key: string]: string };
    stopCoordinatesByStopId: { [key: string]: [number, number] };
    tripsToImport: GtfsTypes.Trip[];
    shapeById: { [key: string]: GtfsTypes.Shapes[] };
    /**
     * The array of stop times by trip id, already sorted by stop sequence
     *
     * @type {StopTimeImportData}
     * @memberof GtfsInternalData
     */
    stopTimesByTripId: StopTimeImportData;
    /**
     * The array of frequencies for a trip, sorted by start time of the
     * frequency
     *
     * @type {FrequencyImportData}
     * @memberof GtfsInternalData
     */
    frequenciesByTripId: FrequencyImportData;
    pathIdsByTripId: { [key: string]: string };
    periodsGroupShortname: string;
    periodsGroup: { name: { [key: string]: string }; periods: Period[] };
    /**
     * Array of agency IDs for which lines and services that already exist
     * should not be updated. Otherwise, existing objects will be updated
     */
    doNotUpdateAgencies: string[];
}

/**
 * Properly formats a color string with a prefixing '#' sign, or returns
 * undefined if no color or default value
 *
 * @param color The color string, prefixed with '#' or not
 * @param defaultColor The default color, prefixed with '#'
 * @returns A color string prefixed with '#', or the default color if undefined,
 * or undefined if no default color specified
 */
export const formatColor = (color: string | undefined, defaultColor?: string) =>
    color !== undefined ? `${color.startsWith('#') ? '' : '#'}${color}` : defaultColor;
