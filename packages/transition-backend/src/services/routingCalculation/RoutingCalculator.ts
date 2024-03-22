/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _isEmpty from 'lodash/isEmpty';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import {
    ResultParams,
    UnimodalRouteCalculationResult
} from 'transition-common/lib/services/transitRouting/RouteCalculatorResult';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import {
    ResultsByMode,
    TransitRoutingCalculator
} from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import transitObjectDataHandlers from '../transitObjects/TransitObjectsDataHandler';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import TransitAccessibilityMapRouting, {
    AccessibilityMapAttributes
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { TransitAccessibilityMapCalculator } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import {
    TransitAccessibilityMapResult,
    TransitAccessibilityMapWithPolygonResult
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import { TrRoutingResultAccessibilityMap } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';

export type SingleRouteCalculationResult =
    | (ResultParams & {
          pathsGeojson?: GeoJSON.FeatureCollection<GeoJSON.LineString>[];
      })
    | undefined;

export type SingleAccessibilityMapCalculationResult =
    | TransitAccessibilityMapWithPolygonResult
    | {
          resultByNode: TrRoutingResultAccessibilityMap | undefined;
      };

export async function calculateRoute(
    attributes: TransitRoutingAttributes,
    withGeojson: boolean
): Promise<SingleRouteCalculationResult> {
    // Start trRouting if it is not running
    const trRoutingStatus = await trRoutingProcessManager.status({});
    if (trRoutingStatus.status === 'not_running') {
        await trRoutingProcessManager.start({});
    }

    const routing: TransitRouting = new TransitRouting(attributes);

    const resultsByMode: ResultsByMode = await TransitRoutingCalculator.calculate(routing, false, {});

    const routingResult = {};
    for (const routingMode in resultsByMode) {
        const modeResult: UnimodalRouteCalculationResult | TransitRoutingResult = resultsByMode[routingMode];
        routingResult[routingMode] = modeResult.getParams();

        if (withGeojson) {
            // The generatePathGeojson function in TransitRoutingResult requires a path collection,
            // so the paths currently in the database are loaded here
            const paths = await transitObjectDataHandlers.paths.geojsonCollection!();
            const pathCollection = new PathCollection(paths.geojson.features, {});
            const options = { completeData: false, pathCollection: pathCollection };

            const pathsGeojson: GeoJSON.FeatureCollection[] = [];
            for (let i = 0; i < modeResult.getAlternativesCount(); i++) {
                const geojson = await modeResult.getPathGeojson(i, options);
                pathsGeojson.push(geojson);
            }
            routingResult[routingMode].pathsGeojson = pathsGeojson;
        }
    }

    return _isEmpty(routingResult) ? undefined : (routingResult as SingleRouteCalculationResult);
}

export async function calculateAccessibilityMap(
    attributes: AccessibilityMapAttributes,
    withGeojson: boolean
): Promise<SingleAccessibilityMapCalculationResult> {
    // Start trRouting if it is not running
    const trRoutingStatus = await trRoutingProcessManager.status({});
    if (trRoutingStatus.status === 'not_running') {
        await trRoutingProcessManager.start({});
    }

    const routing = new TransitAccessibilityMapRouting(attributes);

    let routingResult: SingleAccessibilityMapCalculationResult;

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

    const collectionManager = serviceLocator.collectionManager;
    const nodes = await transitObjectDataHandlers.nodes.geojsonCollection!();
    const nodeCollection = new NodeCollection(nodes.geojson.features, {});
    collectionManager.update('nodes', nodeCollection);
}
