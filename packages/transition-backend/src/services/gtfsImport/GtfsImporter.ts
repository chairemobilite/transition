/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';
import { GtfsImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import AgencyImporter from './AgencyImporter';
import ServiceImporter from './ServiceImporter';
import LineImporter from './LineImporter';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import FrequencyImporter from './FrequencyImporter';
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';
import { GtfsInternalData, ProgressEmitFn, StopTime } from './GtfsImportTypes';
import ShapeImporter from './ShapeImporter';
import StopTimeImporter from './StopTimeImporter';
import TripImporter from './TripImporter';
import ScheduleImporter from './ScheduleImporter';
import PathImporter from './PathImporter';
import StopImporter from './StopImporter';
import PathCollection from 'transition-common/lib/services/path/PathCollection';

// Number of steps for the import, to track progress at every step
const nbImportSteps = 6;

/**
 * Map an error caught during a GTFS import step to a user-facing
 * `TranslatableMessage`. If the error is a `TrError`, surface its
 * `localizedMessage` so the user gets a specific, actionable description
 * (e.g. naming the file that failed). Otherwise fall back to the step's
 * generic message. This keeps the importer agnostic of any specific
 * exception type: any code in the import chain that wants to surface a
 * tailored UI message just needs to throw a `TrError` with a
 * `localizedMessage` set.
 */
const errorToImportMessage = (error: unknown, fallback: TranslatableMessage): TranslatableMessage =>
    TrError.getLocalizedMessage(error) ?? fallback;

/**
 * Import GTFS data from an unzipped gtfs directory
 *
 * @param directory Absolute directory containing the gtfs files to import
 * @param parameters
 * @param progressEmitter
 * @returns
 */
const importGtfsData = async (
    directory: string,
    parameters: GtfsImportData,
    progressEmitter?: EventEmitter
): Promise<
    | { status: 'success'; warnings: TranslatableMessage[]; errors: TranslatableMessage[]; nodesDirty: boolean }
    | { status: 'failed'; errors: TranslatableMessage[]; nodesDirty: boolean }
> => {
    // initialize collection and add them to collection manager, they will be loaded when required
    const lineCollection = new LineCollection([], {});
    const nodeCollection = new NodeCollection([], {});
    const agencies = new AgencyCollection([], {});
    const services = new ServiceCollection([], {});
    const pathCollection = new PathCollection([], {});
    const collectionManager = new CollectionManager(null, {
        lines: lineCollection,
        nodes: nodeCollection,
        agencies,
        services,
        paths: pathCollection
    });

    let nodesDirty = false;
    let currentStepCompleted = 0;

    const emitProgress: ProgressEmitFn | undefined = progressEmitter
        ? (data) => progressEmitter.emit('progress', data)
        : undefined;

    const gtfsInternalData: GtfsInternalData = {
        agencyIdsByAgencyGtfsId: {},
        lineIdsByRouteGtfsId: {},
        serviceIdsByGtfsId: {},
        nodeIdsByStopGtfsId: {},
        stopCoordinatesByStopId: {},
        tripsToImport: [],
        shapeById: {},
        stopTimesByTripId: {},
        frequenciesByTripId: {},
        pathIdsByTripId: {},
        periodsGroupShortname: parameters.periodsGroupShortname || 'default',
        periodsGroup: parameters.periodsGroup,
        doNotUpdateAgencies: []
    };

    // Import the stops
    progressEmitter?.emit('progress', { name: 'ImportingStops', progress: 0.0 });
    progressEmitter?.emit('progress', {
        name: 'ImportingGtfsData',
        progress: (currentStepCompleted / nbImportSteps).toFixed(2)
    });
    await nodeCollection.loadFromServer(serviceLocator.socketEventManager);
    try {
        const { nodeIdsByStopGtfsId, stopCoordinatesByStopId } = await importStops(
            directory,
            parameters,
            nodeCollection,
            emitProgress
        );
        gtfsInternalData.nodeIdsByStopGtfsId = nodeIdsByStopGtfsId;
        gtfsInternalData.stopCoordinatesByStopId = stopCoordinatesByStopId;
        if (Object.keys(nodeIdsByStopGtfsId).length > 0) {
            nodesDirty = true;
        }
        await nodeCollection.loadFromServer(serviceLocator.socketEventManager);
    } catch (error) {
        console.error(`error importing stops: ${error}`);
        return {
            status: 'failed',
            errors: [errorToImportMessage(error, GtfsMessages.NodesImportError)],
            nodesDirty
        };
    } finally {
        progressEmitter?.emit('progress', { name: 'ImportingStops', progress: 1.0 });
        currentStepCompleted++;
    }

    // Import the agencies
    progressEmitter?.emit('progress', { name: 'ImportingAgencies', progress: 0.0 });
    progressEmitter?.emit('progress', {
        name: 'ImportingGtfsData',
        progress: (currentStepCompleted / nbImportSteps).toFixed(2)
    });
    await agencies.loadFromServer(serviceLocator.socketEventManager, collectionManager);
    try {
        const gtfsObjectsImporter = new AgencyImporter({ directoryPath: directory, agencies: agencies });
        const importedAgencies = await gtfsObjectsImporter.import(parameters, gtfsInternalData);
        Object.keys(importedAgencies).forEach((key) => {
            gtfsInternalData.agencyIdsByAgencyGtfsId[key] = importedAgencies[key].getId();
        });
        await agencies.loadFromServer(serviceLocator.socketEventManager, collectionManager);
    } catch (error) {
        console.error(`error importing agencies: ${error}`);
        return {
            status: 'failed',
            errors: [errorToImportMessage(error, GtfsMessages.AgenciesImportError)],
            nodesDirty
        };
    } finally {
        progressEmitter?.emit('progress', { name: 'ImportingAgencies', progress: 1.0 });
        currentStepCompleted++;
    }

    // Import the lines
    progressEmitter?.emit('progress', { name: 'ImportingLines', progress: 0.0 });
    progressEmitter?.emit('progress', {
        name: 'ImportingGtfsData',
        progress: (currentStepCompleted / nbImportSteps).toFixed(2)
    });
    await lineCollection.loadFromServer(serviceLocator.socketEventManager, collectionManager);
    try {
        const gtfsObjectsImporter = new LineImporter({ directoryPath: directory, lines: lineCollection });
        const importedLines = await gtfsObjectsImporter.import(parameters, gtfsInternalData);
        Object.keys(importedLines).forEach(
            (key) => (gtfsInternalData.lineIdsByRouteGtfsId[key] = importedLines[key].getId())
        );
        await lineCollection.loadFromServer(serviceLocator.socketEventManager, collectionManager);
    } catch (error) {
        console.error(`error importing lines: ${error}`);
        return {
            status: 'failed',
            errors: [errorToImportMessage(error, GtfsMessages.LinesImportError)],
            nodesDirty
        };
    } finally {
        progressEmitter?.emit('progress', { name: 'ImportingLines', progress: 1.0 });
        currentStepCompleted++;
    }

    // Import the services
    progressEmitter?.emit('progress', { name: 'ImportingServices', progress: 0.0 });
    progressEmitter?.emit('progress', {
        name: 'ImportingGtfsData',
        progress: (currentStepCompleted / nbImportSteps).toFixed(2)
    });
    await services.loadFromServer(serviceLocator.socketEventManager, collectionManager);
    try {
        const gtfsObjectsImporter = new ServiceImporter({
            directoryPath: directory,
            services: services,
            lines: lineCollection
        });
        const importedServices = await gtfsObjectsImporter.import(parameters, gtfsInternalData);
        Object.keys(importedServices).forEach(
            (key) => (gtfsInternalData.serviceIdsByGtfsId[key] = importedServices[key].getId())
        );
        await services.loadFromServer(serviceLocator.socketEventManager, collectionManager);
    } catch (error) {
        console.error(`error importing lines: ${error}`);
        return {
            status: 'failed',
            errors: [errorToImportMessage(error, GtfsMessages.ServicesImportError)],
            nodesDirty
        };
    } finally {
        progressEmitter?.emit('progress', { name: 'ImportingServices', progress: 1.0 });
        currentStepCompleted++;
    }

    if (!parameters.periodsGroupShortname || !parameters.periodsGroup) {
        return { status: 'success', warnings: [], errors: [], nodesDirty };
    }

    progressEmitter?.emit('progress', { name: 'ImportingPaths', progress: 0.0 });
    progressEmitter?.emit('progress', {
        name: 'ImportingGtfsData',
        progress: (currentStepCompleted / nbImportSteps).toFixed(2)
    });

    const { pathResult, allTrips } = await importPaths(directory, gtfsInternalData, collectionManager, emitProgress);
    progressEmitter?.emit('progress', { name: 'ImportingPaths', progress: 1.0 });
    currentStepCompleted++;
    if (pathResult.status === 'success') {
        progressEmitter?.emit('progress', { name: 'ImportingSchedules', progress: 0.0 });
        progressEmitter?.emit('progress', {
            name: 'ImportingGtfsData',
            progress: (currentStepCompleted / nbImportSteps).toFixed(2)
        });
        gtfsInternalData.pathIdsByTripId = pathResult.pathIdsByTripId;
        // The frequency based schedules need the paths also
        if (parameters.generateFrequencyBasedSchedules === true) {
            await pathCollection.loadFromServer(serviceLocator.socketEventManager);
        }
        const scheduleResponse = await ScheduleImporter.generateAndImportSchedules(
            allTrips,
            gtfsInternalData,
            collectionManager,
            parameters.generateFrequencyBasedSchedules === true,
            emitProgress
        );
        progressEmitter?.emit('progress', { name: 'ImportingSchedules', progress: 1.0 });
        currentStepCompleted++;
        if (scheduleResponse.status === 'success') {
            return {
                status: 'success',
                warnings: pathResult.warnings.concat(scheduleResponse.warnings),
                errors: [],
                nodesDirty
            };
        }
        // Paths were successfully imported, so success, but return warnings and errors
        return { status: 'success', warnings: pathResult.warnings, errors: scheduleResponse.errors, nodesDirty };
    } else {
        return { status: 'failed', errors: pathResult.errors, nodesDirty };
    }
};

const importStops = async (
    directory: string,
    parameters: GtfsImportData,
    nodeCollection: NodeCollection,
    emitProgress?: ProgressEmitFn
): Promise<{
    nodeIdsByStopGtfsId: { [key: string]: string };
    stopCoordinatesByStopId: { [key: string]: [number, number] };
}> => {
    console.log(`generating nodes... found ${nodeCollection.size()} existing nodes.`);

    const stopImporter = new StopImporter({ directoryPath: directory, nodes: nodeCollection });
    const nodesImportData = await stopImporter.prepareImportData();
    const importedNodes = await stopImporter.import(nodesImportData, parameters, emitProgress);
    const nodeIdsByStopGtfsId = {};
    const stopCoordinatesByStopId = {};
    Object.keys(importedNodes).forEach((key) => {
        // Fill the map of gtfs stop id to node id
        nodeIdsByStopGtfsId[key] = importedNodes[key].getId();
        // Fill the map of gtfs stop id to coordinates
        const stopCoords = importedNodes[key].getStop(key)?.geography.coordinates;
        if (stopCoords) {
            stopCoordinatesByStopId[key] = importedNodes[key].getStop(key)?.geography.coordinates;
        }
    });
    return { nodeIdsByStopGtfsId, stopCoordinatesByStopId };
};

const importPaths = async (
    directory: string,
    gtfsInternalData: GtfsInternalData,
    collectionManager: CollectionManager,
    emitProgress?: ProgressEmitFn
): Promise<{
    pathResult:
        | { status: 'success'; pathIdsByTripId: { [key: string]: string }; warnings: TranslatableMessage[] }
        | { status: 'failed'; errors: TranslatableMessage[] };
    allTrips: { [key: string]: { trip: GtfsTypes.Trip; stopTimes: StopTime[] }[] };
}> => {
    // Weights are empirical estimates from STM dataset profiling.
    // The two slow phases are stop-time CSV parsing (~50%) and path generation
    // (~35%). Grouping/sorting by trip is fast in comparison.
    const pathsStepWeights = {
        afterTrips: 0.02,
        afterShapes: 0.05,
        afterStopTimes: 0.58,
        afterFrequencies: 0.59,
        afterTripData: 0.6
    };
    const emitPathsProgress = (progress: number) => emitProgress?.({ name: 'ImportingPaths', progress });

    // Import the paths and schedules from the trip, shape, and stop time data.
    const tripImporter = new TripImporter({ directoryPath: directory });
    gtfsInternalData.tripsToImport = await tripImporter.prepareImportData(gtfsInternalData);
    emitPathsProgress(pathsStepWeights.afterTrips);

    const shapeImporter = new ShapeImporter({ directoryPath: directory });
    const shapes = await shapeImporter.prepareImportData(gtfsInternalData);
    gtfsInternalData.shapeById = ShapeImporter.groupShapesById(shapes);
    emitPathsProgress(pathsStepWeights.afterShapes);

    const stopTimeImporter = new StopTimeImporter({ directoryPath: directory });
    const stopTimeRange = pathsStepWeights.afterStopTimes - pathsStepWeights.afterShapes;
    const afterStopTimeParsing = pathsStepWeights.afterShapes + stopTimeRange * 0.95;
    const stopTimeOnProgress = emitProgress
        ? (fraction: number) =>
            emitPathsProgress(
                pathsStepWeights.afterShapes + fraction * (afterStopTimeParsing - pathsStepWeights.afterShapes)
            )
        : undefined;
    const stopTimes = await stopTimeImporter.prepareImportData(gtfsInternalData, stopTimeOnProgress);
    emitPathsProgress(afterStopTimeParsing);
    const groupOnProgress = emitProgress
        ? (fraction: number) =>
            emitPathsProgress(
                afterStopTimeParsing + fraction * (pathsStepWeights.afterStopTimes - afterStopTimeParsing)
            )
        : undefined;
    gtfsInternalData.stopTimesByTripId = await StopTimeImporter.groupAndSortByTripId(stopTimes, groupOnProgress);
    emitPathsProgress(pathsStepWeights.afterStopTimes);

    const frequencyImporter = new FrequencyImporter({ directoryPath: directory });
    const frequencies = await frequencyImporter.prepareImportData(gtfsInternalData);
    gtfsInternalData.frequenciesByTripId = FrequencyImporter.groupAndSortByTripId(frequencies);
    emitPathsProgress(pathsStepWeights.afterFrequencies);

    const allTrips = ScheduleImporter.prepareTripData(gtfsInternalData);
    emitPathsProgress(pathsStepWeights.afterTripData);

    const pathOnProgress = emitProgress
        ? (fraction: number) =>
            emitPathsProgress(pathsStepWeights.afterTripData + fraction * (1.0 - pathsStepWeights.afterTripData))
        : undefined;
    const pathResult = await PathImporter.generateAndImportPaths(
        allTrips,
        gtfsInternalData,
        collectionManager,
        pathOnProgress
    );

    return { pathResult, allTrips };
};

export default {
    importGtfsData
};
