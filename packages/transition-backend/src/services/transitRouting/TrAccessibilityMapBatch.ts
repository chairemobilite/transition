/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import pQueue from 'p-queue';
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import TransitAccessibilityMapRouting, {
    AccessibilityMapAttributes
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import { parseLocationsFromCsv } from '../accessMapLocation/AccessMapLocationProvider';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import nodeDbQueries from '../../models/db/transitNodes.db.queries';
import scenariosDbQueries from '../../models/db/transitScenarios.db.queries';
import { TransitDemandFromCsvAccessMapAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import { createAccessMapFileResultProcessor } from './TrAccessibilityMapBatchResult';
import { TransitAccessibilityMapCalculator } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';
import { AccessibilityMapLocation } from 'transition-common/lib/services/accessibilityMap/AccessibiltyMapLocation';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

/**
 * Do batch accessibility map on a csv file input
 *
 * TODO The import file should come in parameters somehow, easier when jobs are
 * implemented
 *
 * @param parameters
 * @param accessMapAttributes
 * @param progressEmitter
 * @returns
 */
export const batchAccessibilityMap = async (
    parameters: TransitDemandFromCsvAccessMapAttributes,
    accessMapAttributes: AccessibilityMapAttributes,
    absoluteBaseDirectory: string,
    progressEmitter: EventEmitter,
    isCancelled: () => boolean
): Promise<TransitBatchCalculationResult & { files: { input: string; csv?: string; geojson?: string } }> => {
    // TODO Extract this somewhere, or allow configurable name
    const csvFilePath = 'batchAccessMap.csv';

    const files: { input: string; csv?: string; geojson?: string } = { input: csvFilePath };

    console.log(`importing od trips from CSV file ${csvFilePath}`);
    console.log('reading data from csv file...');

    try {
        const { locations, errors } = await parseLocationsFromCsv(
            `${absoluteBaseDirectory}/${csvFilePath}`,
            parameters
        );

        const locationsCount = locations.length;
        console.log(locationsCount + ' locations parsed');
        progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });

        // Divide odTripCount by 3 for the minimum number of calculation, to avoid creating too many processes if trip count is small
        const trRoutingInstancesCount = Math.max(1, Math.min(Math.ceil(locationsCount / 3), parameters.cpuCount));

        // Start trRouting instances
        progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 0.0 });
        // Because of cancellation, we need to make sure processes are stopped before restarting
        // TODO trRouting should be multi-threaded, this will be useless then.
        await TrRoutingProcessManager.stopMultiple(trRoutingInstancesCount);
        const startStatus = await TrRoutingProcessManager.startMultiple(trRoutingInstancesCount);
        progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 1.0 });

        // Assert the job is not cancelled, otherwise reject
        if (isCancelled()) {
            throw 'Cancelled';
        }
        console.log('trRouting multiple startStatus', startStatus);

        // Prepare the result processor
        const resultProcessor = createAccessMapFileResultProcessor(
            `${absoluteBaseDirectory}/`,
            parameters,
            accessMapAttributes
        );

        // Make sure the serviceLocator has the nodeCollection
        if (serviceLocator.collectionManager.get('nodes') === undefined) {
            const nodeCollection = new NodeCollection([], {});
            const nodeGeojson = await nodeDbQueries.geojsonCollection();
            nodeCollection.loadFromCollection(nodeGeojson.features);
            serviceLocator.collectionManager.add('nodes', nodeCollection);
        }
        const scenarioAttribs = accessMapAttributes.scenarioId
            ? await scenariosDbQueries.read(accessMapAttributes.scenarioId)
            : undefined;
        const scenarioName = scenarioAttribs?.name;

        // Assert the job is not cancelled, otherwise reject
        if (isCancelled()) {
            throw 'Cancelled';
        }
        progressEmitter.emit('progress', { name: 'BatchAccessMap', progress: 0.0 });
        // Number of locations after which to report progress
        const progressStep = Math.ceil(locations.length / 100);

        const poolOfTrRoutingPorts = _cloneDeep(
            Object.keys(TrRoutingProcessManager.getAvailablePortsByStartingPort())
        ).map((portStr) => parseInt(portStr));
        console.log('pool of routing ports', poolOfTrRoutingPorts);

        let completedRoutingsCount = 0;

        const promiseQueue = new pQueue({ concurrency: poolOfTrRoutingPorts.length });

        // Log progress at most for each 1% progress
        const logInterval = Math.ceil(locationsCount / 100);
        const accessMapLocationTask = async ({
            location,
            locationIndex
        }: {
            location: AccessibilityMapLocation;
            locationIndex: number;
        }) => {
            const trRoutingPort = poolOfTrRoutingPorts.pop();
            try {
                if (trRoutingPort === undefined) {
                    throw 'TrRoutingBatch: No available routing port. This should not happen';
                }
                if ((locationIndex + 1) % logInterval === 0) {
                    console.log(`Calculating accessibility map ${locationIndex + 1}/${locationsCount}`);
                }

                const calculationAttributes = _cloneDeep(accessMapAttributes);
                calculationAttributes.locationGeojson = {
                    type: 'Feature' as const,
                    properties: {},
                    geometry: location.geography
                };
                if (location.timeType === 'departure') {
                    calculationAttributes.arrivalTimeSecondsSinceMidnight = undefined;
                    calculationAttributes.departureTimeSecondsSinceMidnight = location.timeOfTrip;
                } else {
                    calculationAttributes.arrivalTimeSecondsSinceMidnight = location.timeOfTrip;
                    calculationAttributes.departureTimeSecondsSinceMidnight = undefined;
                }
                const accessMapRouting = new TransitAccessibilityMapRouting(calculationAttributes);

                try {
                    const routingResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(
                        accessMapRouting,
                        false,
                        {
                            port: trRoutingPort,
                            additionalProperties: {
                                scenarioName,
                                id: location.id
                            },
                            isCancelled
                        }
                    );

                    resultProcessor.processResult(location, Status.createOk(routingResult));
                    return routingResult;
                } catch (error) {
                    resultProcessor.processResult(location, Status.createError(error));
                    throw error;
                } finally {
                    completedRoutingsCount++;
                    if (completedRoutingsCount % progressStep === 0) {
                        progressEmitter.emit('progress', {
                            name: 'BatchAccessMap',
                            progress: completedRoutingsCount / locationsCount
                        });
                    }
                }
            } catch (error) {
                if (error !== 'Cancelled') {
                    errors.push({
                        text: 'transit:transitRouting:errors:ErrorCalculatingLocation',
                        params: { id: location.id || String(locationIndex) }
                    });
                    console.error(`Error getting od trip result ${error}`);
                }
            } finally {
                if (trRoutingPort !== undefined) {
                    poolOfTrRoutingPorts.push(trRoutingPort);
                }
            }
        };

        for (let locationIndex = 0; locationIndex < locations.length; locationIndex++) {
            promiseQueue.add(async () => {
                // Assert the job is not cancelled, otherwise clear the queue and let the job exit
                if (isCancelled()) {
                    promiseQueue.clear();
                }
                await accessMapLocationTask({
                    locationIndex: locationIndex,
                    location: locations[locationIndex]
                });
            });
        }

        await promiseQueue.onIdle();

        progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 0.0 });
        const stopStatus = await TrRoutingProcessManager.stopMultiple(trRoutingInstancesCount);
        progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 1.0 });
        console.log('trRouting multiple stopStatus', stopStatus);

        resultProcessor.end();

        Object.assign(files, resultProcessor.getFiles());

        return {
            calculationName: parameters.calculationName,
            detailed: parameters.detailed,
            completed: true,
            errors: [],
            warnings: errors,
            files
        };
    } catch (error) {
        if (Array.isArray(error)) {
            return {
                calculationName: parameters.calculationName,
                detailed: false,
                completed: false,
                errors: error,
                warnings: [],
                files
            };
        } else {
            console.error(`Error in batch accessibility map calculation: ${error}`);
            throw error;
        }
    } finally {
        progressEmitter.emit('progress', { name: 'BatchAccessMap', progress: 1.0 });
    }
};
