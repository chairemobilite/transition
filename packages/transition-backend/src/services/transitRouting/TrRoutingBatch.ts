/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import _cloneDeep from 'lodash.clonedeep';
import { performance } from 'perf_hooks';
import pQueue from 'p-queue';
import { EventEmitter } from 'events';

import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import routeOdTrip from './TrRoutingOdTrip';
import {
    steps as stepsAttributes,
    base as baseAttributes,
    transit as transitAttributes
} from '../../config/trRoutingAttributes';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { routingModes } from 'chaire-lib-common/lib/config/routingModes';
import { parseOdTripsFromCsv } from '../odTrip/odTripProvider';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitBatchCalculationResult, TransitBatchRoutingAttributes } from 'chaire-lib-common/lib/api/TrRouting';
import odPairsDbQueries from '../../models/db/odPairs.db.queries';
import pathDbQueries from '../../models/db/transitPaths.db.queries';
import { getDataSource } from '../dataSources/dataSources';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const CSV_FILE_NAME = 'batchRoutingResults.csv';
const DETAILED_CSV_FILE_NAME = 'batchRoutingDetailedResults.csv';
const GEOMETRY_FILE_NAME = 'batchRoutingGeometryResults.geojson';

/**
 * Do batch calculation on a csv file input
 *
 * TODO: This was naively copy/pasted from the legacy TrRoutingService class.
 * This function should be split into smaller chunks, with their own
 * responsibility, so this method can have more flexibility and be called with
 * various odTrip sources. Now it handles result stream creation, reading the
 * odTrips from csv and write and notification to caller.
 *
 * @param parameters
 * @param transitRoutingAttributes
 * @param progressEmitter
 * @returns
 */
export const batchRoute = async (
    parameters: TransitBatchRoutingAttributes,
    transitRoutingAttributes: Partial<TransitRoutingAttributes>,
    absoluteBaseDirectory: string,
    progressEmitter: EventEmitter,
    isCancelled: () => boolean
): Promise<
    TransitBatchCalculationResult & {
        files: { input: string; csv?: string; detailedCsv?: string; geojson?: string };
    }
> => {
    console.log('TrRoutingService batchRoute Parameters', parameters);

    // TODO Extract this somewhere, or allow configurable name
    const csvFilePath = 'batchRouting.csv';

    const files: { input: string; csv?: string; detailedCsv?: string; geojson?: string } = { input: csvFilePath };

    const resultsCsvFilePath = `${absoluteBaseDirectory}/${CSV_FILE_NAME}`;
    const resultsCsvDetailedFilePath = `${absoluteBaseDirectory}/${DETAILED_CSV_FILE_NAME}`;
    const resultsGeojsonGeometryFilePath = `${absoluteBaseDirectory}/${GEOMETRY_FILE_NAME}`;

    console.log(`importing od trips from CSV file ${csvFilePath}`);
    console.log('reading data from csv file...');

    try {
        const { odTrips, errors } = await parseOdTripsFromCsv(`${absoluteBaseDirectory}/${csvFilePath}`, parameters);

        const odTripsCount = odTrips.length;
        console.log(odTripsCount + ' OdTrips parsed');
        progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });

        // Divide odTripCount by 3 for the minimum number of calculation, to avoid creating too many processes if trip count is small
        const trRoutingInstancesCount = Math.max(1, Math.min(Math.ceil(odTripsCount / 3), parameters.cpuCount));

        progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 0.0 });

        // Because of cancellation, we need to make sure processes are stopped before restarting
        // TODO trRouting should be multi-threaded, this will be useless then.
        await TrRoutingProcessManager.stopMultiple(trRoutingInstancesCount);
        const startStatus = await TrRoutingProcessManager.startMultiple(trRoutingInstancesCount);

        const batchRoutingPromise = async () => {
            console.log('trRouting multiple startStatus', startStatus);

            progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 1.0 });

            progressEmitter.emit('progress', { name: 'BatchRouting', progress: 0.0 });
            // Number of od pairs after which to report progress
            const progressStep = Math.ceil(odTrips.length / 100);

            let csvStream: fs.WriteStream | undefined = undefined;
            let csvDetailedStream: fs.WriteStream | undefined = undefined;
            let geometryStream: fs.WriteStream | undefined = undefined;
            let pathCollection: PathCollection | undefined = undefined;
            let geometryFileHasData = false;
            const routingObject = new TransitRouting(transitRoutingAttributes);

            const csvAttributes = _cloneDeep(baseAttributes);
            if (routingObject.attributes.routingModes?.includes('transit')) {
                Object.assign(csvAttributes, _cloneDeep(transitAttributes));
            }
            // Add a time and distance column per non-transit mode
            routingObject.attributes.routingModes?.forEach((mode: any) => {
                if (routingModes.includes(mode)) {
                    csvAttributes[`only${mode.charAt(0).toUpperCase() + mode.slice(1)}TravelTimeSeconds`] = null;
                    csvAttributes[`only${mode.charAt(0).toUpperCase() + mode.slice(1)}DistanceMeters`] = null;
                }
            });
            // Make sure if routing is there, that walking is there too
            // TODO This is very custom, can we do something else for this?
            if (
                routingObject.attributes.routingModes?.includes('transit') &&
                !routingObject.attributes.routingModes?.includes('walking')
            ) {
                csvAttributes['onlyWalkingTravelTimeSeconds'] = null;
                csvAttributes['onlyWalkingDistanceMeters'] = null;
            }

            fileManager.writeFileAbsolute(resultsCsvFilePath, '');
            csvStream = fs.createWriteStream(resultsCsvFilePath);
            csvStream.on('error', console.error);
            csvStream.write(Object.keys(csvAttributes).join(',') + '\n');
            if (parameters.detailed) {
                fileManager.writeFileAbsolute(resultsCsvDetailedFilePath, '');
                csvDetailedStream = fs.createWriteStream(resultsCsvDetailedFilePath);
                csvDetailedStream.on('error', console.error);
                csvDetailedStream.write(Object.keys(stepsAttributes).join(',') + '\n');
            }
            if (parameters.withGeometries) {
                pathCollection = new PathCollection([], {});
                if (routingObject.attributes.scenarioId) {
                    const pathGeojson = await pathDbQueries.geojsonCollection({
                        scenarioId: routingObject.attributes.scenarioId
                    });
                    pathCollection.loadFromCollection(pathGeojson.features);
                }
                fileManager.writeFileAbsolute(resultsGeojsonGeometryFilePath, '');
                geometryStream = fs.createWriteStream(resultsGeojsonGeometryFilePath);
                geometryStream.on('error', console.error);
                geometryStream.write('{ "type": "FeatureCollection", "features": [');
            }

            //let completedOdTripsCount = 0;

            const poolOfTrRoutingPorts = _cloneDeep(
                Object.keys(TrRoutingProcessManager.getAvailablePortsByStartingPort())
            ).map((portStr) => parseInt(portStr));

            let completedRoutingsCount = 0;

            const promiseQueue = new pQueue({ concurrency: poolOfTrRoutingPorts.length });

            // Log progress at most for each 1% progress
            const logInterval = Math.ceil(odTripsCount / 100);
            const odTripTask = async ({ odTrip, odTripIndex }: { odTrip: BaseOdTrip; odTripIndex: number }) => {
                const trRoutingPort = poolOfTrRoutingPorts.pop();
                try {
                    if (trRoutingPort === undefined) {
                        throw 'TrRoutingBatch: No available routing port. This should not happen';
                    }
                    if ((odTripIndex + 1) % logInterval === 0) {
                        console.log(`Routing odTrip ${odTripIndex + 1}/${odTripsCount}`);
                    }

                    const routingResult = await routeOdTrip(odTrip, {
                        trRoutingPort,
                        odTripIndex: odTripIndex,
                        odTripsCount,
                        routing: routingObject,
                        exportCsv: true,
                        exportCsvDetailed: parameters.detailed !== false ? true : false,
                        withGeometries: parameters.withGeometries === true ? true : false,
                        reverseOD: false,
                        pathCollection
                    });
                    if (benchmarkStart >= 0 && odTripIndex > 0 && odTripIndex % 100 === 0) {
                        console.log(
                            'calc/sec',
                            Math.round(
                                (100 * completedRoutingsCount) / ((1 / 1000) * (performance.now() - benchmarkStart))
                            ) / 100
                        );
                    }
                    if (geometryStream && routingResult.geometries && routingResult.geometries.length > 0) {
                        // Write the geometry in the stream
                        geometryStream.write(
                            (geometryFileHasData ? ',\n' : '') +
                                routingResult.geometries.map((geometry) => JSON.stringify(geometry)).join(',\n')
                        );
                        geometryFileHasData = true;
                    }
                    if (csvStream && routingResult.csv && routingResult.csv.length > 0) {
                        csvStream.write(routingResult.csv.join('\n') + '\n');
                    }
                    if (
                        csvDetailedStream &&
                        parameters.detailed &&
                        routingResult.csvDetailed &&
                        routingResult.csvDetailed.length > 0
                    ) {
                        csvDetailedStream.write(routingResult.csvDetailed.join('\n') + '\n');
                    }

                    return routingResult;
                } catch (error) {
                    errors.push({
                        text: 'transit:transitRouting:errors:ErrorCalculatingOdTrip',
                        params: { id: odTrip.attributes.internal_id || String(odTripIndex) }
                    });
                    console.error(`Error getting od trip result ${error}`);
                } finally {
                    completedRoutingsCount++;
                    if (completedRoutingsCount % progressStep === 0) {
                        progressEmitter.emit('progress', {
                            name: 'BatchRouting',
                            progress: completedRoutingsCount / odTripsCount
                        });
                    }
                    if (trRoutingPort !== undefined) {
                        poolOfTrRoutingPorts.push(trRoutingPort);
                    }
                }
            };

            const benchmarkStart = performance.now();
            for (let odTripIndex = 0; odTripIndex < odTripsCount; odTripIndex++) {
                promiseQueue.add(async () => {
                    // Assert the job is not cancelled, otherwise clear the queue and let the job exit
                    if (isCancelled()) {
                        promiseQueue.clear();
                    }
                    await odTripTask({
                        odTripIndex,
                        odTrip: odTrips[odTripIndex]
                    });
                });
            }

            await promiseQueue.onIdle();

            if (csvStream) {
                csvStream.end();
                files.csv = CSV_FILE_NAME;
            }
            if (csvDetailedStream) {
                csvDetailedStream.end();
                files.detailedCsv = DETAILED_CSV_FILE_NAME;
            }
            if (geometryStream) {
                geometryStream.write(']}');
                geometryStream.end();
                files.geojson = GEOMETRY_FILE_NAME;
            }

            progressEmitter.emit('progress', { name: 'BatchRouting', progress: 1.0 });
            progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 0.0 });

            const stopStatus = await TrRoutingProcessManager.stopMultiple(trRoutingInstancesCount);

            progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 1.0 });
            console.log('trRouting multiple stopStatus', stopStatus);

            return {
                calculationName: parameters.calculationName,
                detailed: parameters.detailed,
                completed: true,
                errors: [],
                warnings: errors,
                files
            };
        };

        const routingResult = await batchRoutingPromise();

        if (parameters.saveToDb !== false) {
            console.log('Saving OD pairs to database...');
            try {
                await saveOdPairs(odTrips, parameters.saveToDb);
            } catch (error) {
                console.error(
                    `Error saving od pairs to database: ${
                        TrError.isTrError(error) ? JSON.stringify(error.export()) : JSON.stringify(error)
                    }`
                );
                const localizedMessage = TrError.isTrError(error) ? error.export().localizedMessage : '';
                routingResult.warnings.push(
                    localizedMessage !== '' ? localizedMessage : 'transit:transitRouting:errors:ErrorSavingOdTripsToDb'
                );
            }
            console.log('Saved OD pairs to database...');
        }

        return routingResult;
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
            console.error(`Error in batch routing calculation: ${error}`);
            throw error;
        }
    }
};

export const saveOdPairs = async (
    odTrips: BaseOdTrip[],
    saveOptions: { type: 'new'; dataSourceName: string } | { type: 'overwrite'; dataSourceId: string }
) => {
    const dataSource =
        saveOptions.type === 'new'
            ? await getDataSource({ isNew: true, dataSourceName: saveOptions.dataSourceName, type: 'odTrips' })
            : await getDataSource({ isNew: false, dataSourceId: saveOptions.dataSourceId });
    await odPairsDbQueries.deleteForDataSourceId(dataSource.getId());
    await odPairsDbQueries.createMultiple(
        odTrips.map((odTrip) => {
            odTrip.attributes.dataSourceId = dataSource.getId();
            return odTrip.attributes;
        })
    );
};
