/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';

import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GtfsInternalData } from './GtfsImportTypes';

import { GtfsObjectPreparator } from './GtfsObjectPreparator';

export class TripImporter implements GtfsObjectPreparator<GtfsTypes.Trip> {
    private _filePath: string;

    constructor(options: { directoryPath: string }) {
        this._filePath = _isBlank(options.directoryPath)
            ? gtfsFiles.trips.name
            : `${options.directoryPath}/${gtfsFiles.trips.name}`;
    }

    async prepareImportData(importData?: GtfsInternalData): Promise<GtfsTypes.Trip[]> {
        const trips: GtfsTypes.Trip[] = [];
        const importedServices = importData ? Object.keys(importData.serviceIdsByGtfsId) : [];
        const importedRoutes = importData ? Object.keys(importData.lineIdsByRouteGtfsId) : [];
        await parseCsvFile(
            this._filePath,
            (data, _rowNum) => {
                const {
                    route_id,
                    service_id,
                    trip_id,
                    direction_id,
                    wheelchair_accessible,
                    shape_id,
                    bikes_allowed,
                    ...rest
                } = data;
                // Ignore trips for services and routes not imported
                if (!importedServices.includes(service_id) || !importedRoutes.includes(route_id)) {
                    return;
                }
                const directionIdNum = parseInt(direction_id);
                const wheelchairNum = parseInt(wheelchair_accessible);
                const bikesAllowedNum = parseInt(bikes_allowed);
                const trip: GtfsTypes.Trip = {
                    route_id,
                    service_id,
                    trip_id,
                    wheelchair_accessible:
                        wheelchairNum >= 0 && wheelchairNum <= 2 ? (wheelchairNum as GtfsTypes.GTFSBool) : 0,
                    bikes_allowed:
                        bikesAllowedNum >= 0 && bikesAllowedNum <= 2 ? (bikesAllowedNum as GtfsTypes.GTFSBool) : 0,
                    ...rest
                };
                if (directionIdNum >= 0 && directionIdNum <= 1) {
                    trip.direction_id = directionIdNum as 0 | 1;
                }
                if (shape_id && shape_id !== '') {
                    trip.shape_id = shape_id;
                }

                trips.push(trip);
            },
            { header: true }
        );
        return trips;
    }
}

export default TripImporter;
