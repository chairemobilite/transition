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
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import AgencyImporter from './AgencyImporter';
import ServiceImporter from './ServiceImporter';
import LineImporter from './LineImporter';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import FrequencyImporter from './FrequencyImporter';
import { GtfsInternalData } from './GtfsImportTypes';
import ShapeImporter from './ShapeImporter';
import StopTimeImporter from './StopTimeImporter';
import TripImporter from './TripImporter';
import ScheduleImporter from './ScheduleImporter';
import PathImporter from './PathImporter';
import StopImporter from './StopImporter';

// Number of steps for the import, to track progress at every step
const nbImportSteps = 6;

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
    | { status: 'success'; warnings: ErrorMessage[]; errors: ErrorMessage[]; nodesDirty: boolean }
    | { status: 'failed'; errors: ErrorMessage[]; nodesDirty: boolean }
> => {
    // initialize collection and add them to collection manager, they will be loaded when required
    const lineCollection = new LineCollection([], {});
    const nodeCollection = new NodeCollection([], {});
    const agencies = new AgencyCollection([], {});
    const services = new ServiceCollection([], {});
    const collectionManager = new CollectionManager(null, {
        lines: lineCollection,
        nodes: nodeCollection,
        agencies,
        services
    });

    let nodesDirty = false;
    let currentStepCompleted = 0;

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
            nodeCollection
        );
        gtfsInternalData.nodeIdsByStopGtfsId = nodeIdsByStopGtfsId;
        gtfsInternalData.stopCoordinatesByStopId = stopCoordinatesByStopId;
        if (Object.keys(nodeIdsByStopGtfsId).length > 0) {
            nodesDirty = true;
        }
        await nodeCollection.loadFromServer(serviceLocator.socketEventManager);
    } catch (error) {
        console.error(`error importing stops: ${error}`);
        return { status: 'failed', errors: [GtfsMessages.NodesImportError], nodesDirty };
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
        return { status: 'failed', errors: [GtfsMessages.AgenciesImportError], nodesDirty };
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
        return { status: 'failed', errors: [GtfsMessages.LinesImportError], nodesDirty };
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
        return { status: 'failed', errors: [GtfsMessages.ServicesImportError], nodesDirty };
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

    // Import the paths and schedules from the trip, shape, and stop time data.
    const tripImporter = new TripImporter({ directoryPath: directory });
    gtfsInternalData.tripsToImport = await tripImporter.prepareImportData(gtfsInternalData);

    const shapeImporter = new ShapeImporter({ directoryPath: directory });
    const shapes = await shapeImporter.prepareImportData(gtfsInternalData);
    gtfsInternalData.shapeById = ShapeImporter.groupShapesById(shapes);

    const stopTimeImporter = new StopTimeImporter({ directoryPath: directory });
    const stopTimes = await stopTimeImporter.prepareImportData(gtfsInternalData);
    gtfsInternalData.stopTimesByTripId = StopTimeImporter.groupAndSortByTripId(stopTimes);

    const frequencyImporter = new FrequencyImporter({ directoryPath: directory });
    const frequencies = await frequencyImporter.prepareImportData(gtfsInternalData);
    gtfsInternalData.frequenciesByTripId = FrequencyImporter.groupAndSortByTripId(frequencies);

    const allTrips = ScheduleImporter.prepareTripData(gtfsInternalData);
    const pathResult = await PathImporter.generateAndImportPaths(allTrips, gtfsInternalData, collectionManager);
    progressEmitter?.emit('progress', { name: 'ImportingPaths', progress: 1.0 });
    currentStepCompleted++;
    if (pathResult.status === 'success') {
        progressEmitter?.emit('progress', { name: 'ImportingSchedules', progress: 0.0 });
        progressEmitter?.emit('progress', {
            name: 'ImportingGtfsData',
            progress: (currentStepCompleted / nbImportSteps).toFixed(2)
        });
        gtfsInternalData.pathIdsByTripId = pathResult.pathIdsByTripId;
        const scheduleResponse = await ScheduleImporter.generateAndImportSchedules(
            allTrips,
            gtfsInternalData,
            collectionManager
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
    nodeCollection: NodeCollection
): Promise<{
    nodeIdsByStopGtfsId: { [key: string]: string };
    stopCoordinatesByStopId: { [key: string]: [number, number] };
}> => {
    console.log(`generating nodes... found ${nodeCollection.size()} existing nodes.`);

    const stopImporter = new StopImporter({ directoryPath: directory, nodes: nodeCollection });
    const nodesImportData = await stopImporter.prepareImportData();
    const importedNodes = await stopImporter.import(nodesImportData, parameters);
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

export default {
    importGtfsData
};
