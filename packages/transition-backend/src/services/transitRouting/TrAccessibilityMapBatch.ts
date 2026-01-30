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
import { TrRoutingBatchManager } from './TrRoutingBatchManager';
import { parseLocationsFromCsv } from '../accessMapLocation/AccessMapLocationProvider';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import nodeDbQueries from '../../models/db/transitNodes.db.queries';
import scenariosDbQueries from '../../models/db/transitScenarios.db.queries';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import { createAccessMapFileResultProcessor } from './TrAccessibilityMapBatchResult';
import { TransitAccessibilityMapCalculator } from '../accessibilityMap/TransitAccessibilityMapCalculator';
import { AccessibilityMapLocation } from 'transition-common/lib/services/accessibilityMap/AccessibiltyMapLocation';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ExecutableJob } from '../executableJob/ExecutableJob';
import { BatchAccessMapJobType } from './BatchAccessibilityMapJob';

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
    job: ExecutableJob<BatchAccessMapJobType>,
    progressEmitter: EventEmitter,
    isCancelled: () => boolean
): Promise<TransitBatchCalculationResult & { files: { input: string; csv?: string; geojson?: string } }> => {
    //TODO getInputFileName could in theory throw and it won't be catched here, but we validate earlier
    // that we actually have an input file, so won't happen in reality
    const files: { input: string; csv?: string; geojson?: string } = { input: job.getInputFileName() };
    const parameters = job.attributes.data.parameters.batchAccessMapAttributes;
    console.log(`importing access map locations from CSV file ${job.getInputFileName()}`);

    // Create the batch manager for TrRouting lifecycle
    const batchManager = new TrRoutingBatchManager(progressEmitter);

    try {
        const { locations, errors } = await parseLocationsFromCsv(job.getInputFilePath(), parameters);

        const locationsCount = locations.length;
        console.log(locationsCount + ' locations parsed');
        progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });

        const { threadCount: trRoutingThreadsCount, port: trRoutingPort } = await batchManager.startBatch(
            locationsCount
            // TODO add options with cachePath
        );

        // Assert the job is not cancelled, otherwise reject
        if (isCancelled()) {
            throw 'Cancelled';
        }

        // Prepare the result processor
        const resultProcessor = createAccessMapFileResultProcessor(
            job.getJobFileDirectory(),
            parameters,
            job.attributes.data.parameters.accessMapAttributes
        );

        // Make sure the serviceLocator has the nodeCollection
        if (serviceLocator.collectionManager.get('nodes') === undefined) {
            const nodeCollection = new NodeCollection([], {});
            const nodeGeojson = await nodeDbQueries.geojsonCollection();
            nodeCollection.loadFromCollection(nodeGeojson.features);
            serviceLocator.collectionManager.add('nodes', nodeCollection);
        }
        const scenarioAttribs = job.attributes.data.parameters.accessMapAttributes.scenarioId
            ? await scenariosDbQueries.read(job.attributes.data.parameters.accessMapAttributes.scenarioId)
            : undefined;
        const scenarioName = scenarioAttribs?.name;

        // Assert the job is not cancelled, otherwise reject
        if (isCancelled()) {
            throw 'Cancelled';
        }
        progressEmitter.emit('progress', { name: 'BatchAccessMap', progress: 0.0 });

        let completedRoutingsCount = 0;

        const promiseQueue = new pQueue({ concurrency: trRoutingThreadsCount });

        // Log progress at most for each 1% progress
        const logInterval = Math.max(1, Math.ceil(locationsCount / 100));
        const accessMapLocationTask = async ({
            location,
            locationIndex
        }: {
            location: AccessibilityMapLocation;
            locationIndex: number;
        }) => {
            try {
                if ((locationIndex + 1) % logInterval === 0) {
                    console.log(`Calculating accessibility map ${locationIndex + 1}/${locationsCount}`);
                }

                const calculationAttributes = _cloneDeep(job.attributes.data.parameters.accessMapAttributes);
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
                calculationAttributes.calculatePois = parameters.calculatePois;

                try {
                    const routingResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(
                        calculationAttributes,
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
                    if (completedRoutingsCount % logInterval === 0) {
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
                    console.error(`Error calculating accessibility map location: ${error}`);
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

        resultProcessor.end();

        Object.assign(files, resultProcessor.getFiles());

        return {
            completed: true,
            errors: [],
            warnings: errors,
            files
        };
    } catch (error) {
        if (Array.isArray(error)) {
            return {
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
        // Stop TrRouting instance
        await batchManager.stopBatch();

        progressEmitter.emit('progress', { name: 'BatchAccessMap', progress: 1.0 });
    }
};
