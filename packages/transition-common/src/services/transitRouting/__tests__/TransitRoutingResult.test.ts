/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { SegmentToGeoJSONFromPaths } from "../TransitRoutingResult";
import { pathNoTransferRouteResult } from 'chaire-lib-common/lib/test/services/transitRouting/TrRoutingConstantsStubs';
import { PathCollection } from '../../path/PathCollection';
import { getPathObject } from '../../path/__tests__/PathData.test';
import { TrRoutingV2 } from 'chaire-lib-common/lib/api/TrRouting';

// Add a path to the path collection
const pathCollection = new PathCollection([], {});
const defaultPath = getPathObject({ pathCollection }, 'default');
const realPath = getPathObject({ pathCollection }, 'smallReal');

describe('SegmentToGeoJSONFromPaths', () => {
    const segmentToGeoJSONFromPaths = new SegmentToGeoJSONFromPaths(pathCollection);

    test('segmentToGeoJSONFromPaths, with default path, without segments', async () => {
        // Update the path uuid in the result to match the one in the path collection
        const trRoutingResult = _cloneDeep(pathNoTransferRouteResult);
        const boardStep = trRoutingResult.steps[1] as TrRoutingV2.TripStepBoarding;
        const unboardStep = trRoutingResult.steps[2] as TrRoutingV2.TripStepUnboarding;
        (trRoutingResult.steps[1] as any).pathUuid = defaultPath.id;
        (trRoutingResult.steps[2] as any).pathUuid = defaultPath.id;

        const segment = await segmentToGeoJSONFromPaths.segmentToGeoJSONFromPaths(boardStep as any, unboardStep as any, false, 0);
        expect(segment).toEqual({
            type: 'Feature',
            id: 0,
            properties: {
                distanceMeters: unboardStep.inVehicleDistance,
                travelTimeSeconds: unboardStep.inVehicleTime,
                action: 'ride',
                stepSequence: 0,
                mode: boardStep.mode,
                color: undefined
            },
            geometry: {
                type: 'LineString',
                // No segments, the whole path should be there
                coordinates: defaultPath.attributes.geography.coordinates
            }
        });
    });

    test('segmentToGeoJSONFromPaths, with small read path, with segments', async () => {
        // Update the path uuid and legSequence in the result to match the one in the path collection
        const trRoutingResult = _cloneDeep(pathNoTransferRouteResult);
        const boardStep = trRoutingResult.steps[1] as TrRoutingV2.TripStepBoarding;
        const unboardStep = trRoutingResult.steps[2] as TrRoutingV2.TripStepUnboarding;
        boardStep.pathUuid = realPath.id;
        boardStep.legSequenceInTrip = 2;
        boardStep.stopSequenceInTrip = 2;
        unboardStep.pathUuid = realPath.id;
        unboardStep.legSequenceInTrip = 3;
        unboardStep.stopSequenceInTrip = 3;

        const segment = await segmentToGeoJSONFromPaths.segmentToGeoJSONFromPaths(boardStep as any, unboardStep as any, false, 0);
        expect(segment).toEqual({
            type: 'Feature',
            id: 0,
            properties: {
                distanceMeters: unboardStep.inVehicleDistance,
                travelTimeSeconds: unboardStep.inVehicleTime,
                action: 'ride',
                stepSequence: 0,
                mode: boardStep.mode,
                color: undefined
            },
            geometry: {
                type: 'LineString',
                coordinates: realPath.attributes.geography.coordinates.slice(realPath.attributes.segments[1], realPath.attributes.geography.coordinates.length)
            }
        });
    });
});


