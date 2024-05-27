/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _isEmpty from 'lodash/isEmpty';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { UnimodalRoutingResultData, UnimodalRoutingResult } from 'chaire-lib-common/lib/services/routing/RoutingResult';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
import {
    ResultsByMode,
    TransitRoutingCalculator
} from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';
import {
    TransitResultParams,
    TransitRoutingResult
} from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import TransitAccessibilityMapRouting from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { TransitAccessibilityMapCalculator } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import {
    TransitAccessibilityMapResult,
    TransitAccessibilityMapWithPolygonResult
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import { TrRoutingResultAccessibilityMap } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';

export type UnimodalRouteCalculationResultParams = UnimodalRoutingResultData & {
    pathsGeojson?: GeoJSON.FeatureCollection<GeoJSON.LineString>[];
};

export type TransitRouteCalculationResultParams = TransitResultParams & {
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
    routing: TransitRouting,
    withGeojson: boolean
): Promise<RouteCalculationResultParamsByMode> {
    // Start trRouting if it is not running
    const trRoutingStatus = await trRoutingProcessManager.status({});
    if (trRoutingStatus.status === 'not_running') {
        await trRoutingProcessManager.start({});
    }

    const resultsByMode: ResultsByMode = await TransitRoutingCalculator.calculate(routing, false, {});

    const routingResult: RouteCalculationResultParamsByMode = {};
    for (const routingMode in resultsByMode) {
        const modeResult: UnimodalRoutingResult | TransitRoutingResult = resultsByMode[routingMode];
        routingResult[routingMode] = modeResult.getParams();

        if (withGeojson) {
            // The generatePathGeojson function in TransitRoutingResult requires a path collection,
            // so the paths currently in the database are loaded here
            const pathCollection = new PathCollection([], {});
            await pathCollection.loadFromServer(serviceLocator.socketEventManager);
            const options = { completeData: false, pathCollection: pathCollection };

            const pathsGeojson: GeoJSON.FeatureCollection[] = [];
            for (let i = 0; i < modeResult.getAlternativesCount(); i++) {
                const geojson = await modeResult.getPathGeojson(i, options);
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
        routingResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(routing, false, {});
    } else {
        const accessibilityMap: TransitAccessibilityMapResult = await TransitAccessibilityMapCalculator.calculate(
            routing,
            false,
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
