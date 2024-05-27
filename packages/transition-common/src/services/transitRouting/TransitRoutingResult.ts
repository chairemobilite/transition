/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash/get';

import { TrRoutingV2 } from 'chaire-lib-common/lib/api/TrRouting';
import PathCollection from '../path/PathCollection';
import { SegmentToGeoJSON, StepGeojsonProperties } from 'chaire-lib-common/lib/services/routing/TransitRoutingResult';

export class SegmentToGeoJSONFromPaths {
    constructor(private _pathCollection: PathCollection) {
        /** Nothing to do */
    }

    segmentToGeoJSONFromPaths: SegmentToGeoJSON = async (
        boardStep: TrRoutingV2.TripStepBoarding,
        unboardStep: TrRoutingV2.TripStepUnboarding,
        completeData: boolean,
        currentStepIndex: number
    ): Promise<GeoJSON.Feature<GeoJSON.LineString>> => {
        let properties: StepGeojsonProperties = {
            distanceMeters: unboardStep.inVehicleDistance,
            travelTimeSeconds: unboardStep.inVehicleTime,
            stepSequence: currentStepIndex,
            action: 'ride',
            mode: boardStep.mode
        };
        if (completeData) {
            properties = {
                ...properties,
                departureTimeSeconds: boardStep.departureTime,
                agencyAcronym: boardStep.agencyAcronym,
                agencyUuid: boardStep.agencyUuid,
                lineShortname: boardStep.lineShortname,
                lineUuid: boardStep.lineUuid,
                pathUuid: boardStep.pathUuid,
                legSequenceInTrip: boardStep.legSequenceInTrip,
                arrivalTimeSeconds: unboardStep.arrivalTime
            };
        }

        const path = this._pathCollection.getById(unboardStep.pathUuid);
        if (path && path.geometry) {
            const pathCoordinates = path.geometry.coordinates;
            const pathSegments = path.properties.segments;
            const startSequence = boardStep.legSequenceInTrip - 1;
            const endSequence = unboardStep.legSequenceInTrip - 1;
            const pathCoordinatesStartIndex = pathSegments[startSequence];
            const pathCoordinatesEndIndex =
                pathSegments.length - 1 >= endSequence + 1 ? pathSegments[endSequence + 1] : pathCoordinates.length - 1;
            const segmentCoordinates = pathCoordinates.slice(pathCoordinatesStartIndex, pathCoordinatesEndIndex + 1); // slice does not include end index
            properties['color'] = path.properties.color;

            return {
                type: 'Feature',
                id: currentStepIndex,
                properties,
                geometry: {
                    type: 'LineString',
                    coordinates: segmentCoordinates
                }
            };
        }
        return {
            type: 'Feature',
            id: currentStepIndex,
            properties,
            geometry: {
                type: 'LineString',
                coordinates: [boardStep.nodeCoordinates, unboardStep.nodeCoordinates]
            }
        };
    };
}
