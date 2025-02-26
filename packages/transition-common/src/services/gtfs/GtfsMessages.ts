/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** Map of GTFS-related messages to the string used to display the actual
 * translated message */
export const GtfsMessages = {
    TripWithNoShape: 'transit:gtfs:errors:TripHasNoShape',
    CannotGenerateFromGtfsShape: 'transit:gtfs:errors:CannotGenerateShapeFromGtfs',
    CannotGenerateFromStopTimes: 'transit:gtfs:errors:CannotGenerateShapeFromStopTimes',
    PathGenerationErrorForLine: 'transit:gtfs:errors:PathGenerationErrorForLine',
    PathGenerationError: 'transit:gtfs:errors:PathGenerationError',
    TooManyErrorsImportingSchedules: 'transit:gtfs:errors:TooManyErrorsImportingSchedules',
    ErrorImportingSchedulesForLine: 'transit:gtfs:errors:ErrorImportingSchedulesForLine',
    NodesImportError: 'transit:gtfs:errors:ErrorImportingNodes',
    AgenciesImportError: 'transit:gtfs:errors:ErrorImportingAgencies',
    LinesImportError: 'transit:gtfs:errors:ErrorImportingLines',
    ServicesImportError: 'transit:gtfs:errors:ErrorImportingServices',
    GtfsExportError: 'transit:gtfs:errors:ErrorExportingGtfs'
};
