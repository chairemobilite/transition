/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { UnimodalRoutingResultData } from 'chaire-lib-common/lib/services/routing/RoutingResult';
import { Routing } from 'chaire-lib-backend/lib/services/routing/Routing';
import { RoutingResultsByMode, TripRoutingQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';
import { TransitRoutingResultData } from 'chaire-lib-common/lib/services/routing/TransitRoutingResult';
import { resultToObject } from 'chaire-lib-common/lib/services/routing/RoutingResultUtils';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import TransitAccessibilityMapRouting from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { TransitAccessibilityMapCalculator } from '../accessibilityMap/TransitAccessibilityMapCalculator';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import {
    TransitAccessibilityMapResult,
    TransitAccessibilityMapWithPolygonResult
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import { TrRoutingResultAccessibilityMap } from 'chaire-lib-common/lib/services/transitRouting/types';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';
import { SegmentToGeoJSONFromPaths } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';

export type UnimodalRouteCalculationResultParams = UnimodalRoutingResultData & {
    pathsGeojson?: GeoJSON.FeatureCollection<GeoJSON.LineString>[];
};

export type TransitRouteCalculationResultParams = TransitRoutingResultData & {
    pathsGeojson?: GeoJSON.FeatureCollection<GeoJSON.LineString>[];
};

export type RouteCalculationResultParamsByMode = {
    [key in RoutingMode]?: UnimodalRouteCalculationResultParams;
} & {
    transit?: TransitRouteCalculationResultParams;
};

export type AccessibilityMapCalculationResult =
    | TransitAccessibilityMapWithPolygonResult
    | {
          resultByNode: TrRoutingResultAccessibilityMap | undefined;
      };

export async function calculateRoute(
    routingAttributes: TripRoutingQueryAttributes,
    withGeojson: boolean
): Promise<RouteCalculationResultParamsByMode> {
    // Start trRouting if it is not running
    const trRoutingStatus = await trRoutingProcessManager.status({});
    if (trRoutingStatus.status === 'not_running') {
        await trRoutingProcessManager.start({});
    }

    const resultsByMode: RoutingResultsByMode = await Routing.calculate(routingAttributes);

    const routingResult: RouteCalculationResultParamsByMode = {};
    for (const routingMode in resultsByMode) {
        const modeResult = resultsByMode[routingMode];
        routingResult[routingMode] = modeResult;

        if (withGeojson) {
            const resultObject = resultToObject(modeResult);
            // The generatePathGeojson function in TransitRoutingResult requires a path collection,
            // so the paths currently in the database are loaded here
            const pathCollection = new PathCollection([], {});
            await pathCollection.loadFromServer(serviceLocator.socketEventManager);
            const segmentToGeojson = new SegmentToGeoJSONFromPaths(pathCollection);
            const options = { completeData: false, segmentToGeojson: segmentToGeojson.segmentToGeoJSONFromPaths };

            const pathsGeojson: GeoJSON.FeatureCollection[] = [];
            for (let i = 0; i < resultObject.getAlternativesCount(); i++) {
                const geojson = await resultObject.getPathGeojson(i, options);
                pathsGeojson.push(geojson);
            }
            routingResult[routingMode].pathsGeojson = pathsGeojson;
        }
    }

    return routingResult;
}

export async function calculateAccessibilityMap(
    routing: TransitAccessibilityMapRouting,
    withGeojson: boolean
): Promise<AccessibilityMapCalculationResult> {
    // Start trRouting if it is not running
    const trRoutingStatus = await trRoutingProcessManager.status({});
    if (trRoutingStatus.status === 'not_running') {
        await trRoutingProcessManager.start({});
    }

    let routingResult: AccessibilityMapCalculationResult;

    if (withGeojson) {
        // The calculateWithPolygons function in TransitAccessibilityMapCalculator requires a node collection,
        // so the nodes currently in the database are loaded here
        await updateNodeCollection();
        routingResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(routing.getAttributes(), {});
    } else {
        const accessibilityMap: TransitAccessibilityMapResult = await TransitAccessibilityMapCalculator.calculate(
            routing.getAttributes(),
            {}
        );
        routingResult = {
            resultByNode: accessibilityMap.routingResult
        };
    }

    return routingResult;
}

async function updateNodeCollection() {
    if (!serviceLocator.hasService('collectionManager')) {
        serviceLocator.addService('collectionManager', new CollectionManager(undefined));
    }

    const nodeCollection = new NodeCollection([], {});
    await nodeCollection.loadFromServer(serviceLocator.socketEventManager);
    serviceLocator.collectionManager.update('nodes', nodeCollection);
}
