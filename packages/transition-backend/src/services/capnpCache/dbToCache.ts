/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import agenciesDbQueries from '../../models/db/transitAgencies.db.queries';
import { collectionToCache as agencyCollectionToCache } from '../../models/capnpCache/transitAgencies.cache.queries';

import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import servicesDbQueries from '../../models/db/transitServices.db.queries';
import { collectionToCache as serviceCollectionToCache } from '../../models/capnpCache/transitServices.cache.queries';

import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import scenariosDbQueries from '../../models/db/transitScenarios.db.queries';
import { collectionToCache as scenarioCollectionToCache } from '../../models/capnpCache/transitScenarios.cache.queries';

import LineCollection from 'transition-common/lib/services/line/LineCollection';
import linesDbQueries from '../../models/db/transitLines.db.queries';
import {
    collectionToCache as lineCollectionToCache,
    objectsToCache as lineObjectsToCache
} from '../../models/capnpCache/transitLines.cache.queries';

import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import nodesDbQueries from '../../models/db/transitNodes.db.queries';
import { saveAndUpdateAllNodes, saveAllNodesToCache } from '../nodes/NodeCollectionUtils';
import { collectionToCache as nodeCollectionToCache } from '../../models/capnpCache/transitNodes.cache.queries';

import PlaceCollection from 'transition-common/lib/services/places/PlaceCollection';
import placesDbQueries from '../../models/db/places.db.queries';

import PathCollection from 'transition-common/lib/services/path/PathCollection';
import pathsDbQueries from '../../models/db/transitPaths.db.queries';
import { collectionToCache as pathCollectionToCache } from '../../models/capnpCache/transitPaths.cache.queries';

import DataSourceCollection from 'chaire-lib-common/lib/services/dataSource/DataSourceCollection';
import dataSourceDbQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import { collectionToCache as dataSourceCollectionToCache } from '../../models/capnpCache/dataSources.cache.queries';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';

/**
 * Load data sources from database and save to cache
 */
export const loadAndSaveDataSourcesToCache = async (cachePathDirectory?: string): Promise<void> => {
    const dataSourceCollection = new DataSourceCollection([], {});
    const dataSources = await dataSourceDbQueries.collection();
    dataSourceCollection.loadFromCollection(dataSources);
    await dataSourceCollectionToCache(dataSourceCollection, cachePathDirectory);
    console.log('saved data sources collection to cache');
};

/**
 * Load agencies from database and save to cache
 */
export const loadAndSaveAgenciesToCache = async (cachePathDirectory?: string): Promise<void> => {
    const agencyCollection = new AgencyCollection([], {});
    const agencies = await agenciesDbQueries.collection();
    agencyCollection.loadFromCollection(agencies);
    await agencyCollectionToCache(agencyCollection, cachePathDirectory);
    console.log('saved agencies collection to cache');
};

/**
 * Load services from database and save to cache
 */
export const loadAndSaveServicesToCache = async (cachePathDirectory?: string): Promise<void> => {
    const serviceCollection = new ServiceCollection([], {});
    const services = await servicesDbQueries.collection();
    serviceCollection.loadFromCollection(services);
    await serviceCollectionToCache(serviceCollection, cachePathDirectory);
    console.log('saved services collection to cache');
};

/**
 * Load scenarios from database and save to cache
 */
export const loadAndSaveScenariosToCache = async (cachePathDirectory?: string): Promise<void> => {
    const scenarioCollection = new ScenarioCollection([], {});
    const scenarios = await scenariosDbQueries.collection();
    scenarioCollection.loadFromCollection(scenarios);
    await scenarioCollectionToCache(scenarioCollection, cachePathDirectory);
    console.log('saved scenarios collection to cache');
};

/**
 * Load lines from database and save to cache
 * @param options.saveIndividualLines - If true, save individual line objects with their schedules
 * @param options.cachePathDirectory - Optional cache directory path
 */
export const loadAndSaveLinesToCache = async (
    options: { saveIndividualLines?: boolean; cachePathDirectory?: string } = {}
): Promise<void> => {
    const lineCollection = new LineCollection([], {});
    const lines = await linesDbQueries.collection();
    lineCollection.loadFromCollection(lines);
    await lineCollectionToCache(lineCollection, options.cachePathDirectory);
    console.log('saved lines collection to cache');

    if (options.saveIndividualLines) {
        await saveLineObjectsToCache(lineCollection, options.cachePathDirectory);
    }
};

/**
 * Load specific lines by IDs and save to cache
 * @param lineIds - Array of line IDs to load and save
 * @param cachePathDirectory - Optional cache directory path
 */
export const loadAndSaveLinesByIdsToCache = async (lineIds: string[], cachePathDirectory?: string): Promise<void> => {
    if (lineIds.length === 0) {
        return;
    }

    const lineCollection = new LineCollection([], {});
    const lines = await linesDbQueries.collection(lineIds);
    lineCollection.loadFromCollection(lines);

    await saveLineObjectsToCache(lineCollection, cachePathDirectory);
};

const saveLineObjectsToCache = async (lines: LineCollection, cachePathDirectory?: string): Promise<void> => {
    const lineObjects = lines.getFeatures();
    // Save line objects with their schedules to cache in chunks
    const linesToSave = [...lineObjects];
    while (linesToSave.length > 0) {
        // Save line objects with their schedules to cache in chunks
        const chunk = linesToSave.splice(0, 100);
        // Load lines with schedules
        await linesDbQueries.collectionWithSchedules(chunk);
        await lineObjectsToCache(chunk, cachePathDirectory);
    }
    console.log(`saved ${lineObjects.length} individual line(s) with schedules to cache`);
};

/**
 * Load nodes from database and save to cache
 * @param options.refreshTransferrableNodes - If true, recalculate transferrable nodes (requires serviceLocator)
 * @param options.cachePathDirectory - Optional cache directory path
 */
export const loadAndSaveNodesToCache = async (
    options: { refreshTransferrableNodes?: boolean; cachePathDirectory?: string } = {}
): Promise<void> => {
    const nodeCollection = new NodeCollection([], {});
    const placeCollection = new PlaceCollection([], {});

    const nodesGeojson = await nodesDbQueries.geojsonCollection();
    nodeCollection.loadFromCollection(nodesGeojson.features);
    await nodeCollectionToCache(nodeCollection, options.cachePathDirectory);
    console.log('saved nodes collection to cache');

    // TODO saveAndUpdateAll requires the serviceLocator to have a socketEventManager, which the main server process does not have. Only tasks can update them
    if (options.refreshTransferrableNodes) {
        console.log('refreshing transferrable nodes');
        // Only the collection should be required, not a collection manager, but the side effects to change this go deep...
        const nodeCollManager = new CollectionManager(undefined);
        const placesGeojson = await placesDbQueries.geojsonCollection([]);
        placeCollection.loadFromCollection(placesGeojson.features);
        nodeCollManager.add('nodes', nodeCollection);
        try {
            await saveAndUpdateAllNodes(
                nodeCollection,
                placeCollection,
                serviceLocator.eventManager,
                nodeCollManager,
                options.cachePathDirectory
            );
            console.log('saved individual nodes with transferable nodes to cache');
        } catch (error) {
            console.error('Could save the nodes to cache', error);
        }
    } else {
        const nodeCollManager = new CollectionManager(undefined);
        const placesGeojson = await placesDbQueries.geojsonCollection([]);
        placeCollection.loadFromCollection(placesGeojson.features);
        nodeCollManager.add('nodes', nodeCollection);
        await saveAllNodesToCache(nodeCollection, nodeCollManager, options.cachePathDirectory);
        console.log('saved individual nodes with transferable nodes to cache (from DB)');
    }
};

/**
 * Load paths from database and save to cache
 */
export const loadAndSavePathsToCache = async (cachePathDirectory?: string): Promise<void> => {
    const pathCollection = new PathCollection([], {});
    const pathsGeojson = await pathsDbQueries.geojsonCollection({ noNullGeo: true });
    pathCollection.loadFromCollection(pathsGeojson.features);
    await pathCollectionToCache(pathCollection, cachePathDirectory);
    console.log('saved paths collection to cache');
};

/**
 * Recreate the cache from the database
 *
 * @params Options to recreate the cache: refreshTransferrableNodes requires the
 * serviceLocator to be initialized. Only tasks can run this, the main process
 * does not have access to it. When the Node class has been refactor to not
 * depend on the socket, then we can enable this parameter in any case.
 * saveLines saves all the line objects, along with their schedules.
 */
export const recreateCache = async (
    options: { refreshTransferrableNodes: boolean; saveLines: boolean; cachePathDirectory?: string } = {
        refreshTransferrableNodes: false,
        saveLines: true
    }
) => {
    await loadAndSaveDataSourcesToCache(options.cachePathDirectory);
    await loadAndSaveAgenciesToCache(options.cachePathDirectory);
    await loadAndSaveServicesToCache(options.cachePathDirectory);
    await loadAndSaveScenariosToCache(options.cachePathDirectory);
    await loadAndSaveLinesToCache({
        saveIndividualLines: options.saveLines,
        cachePathDirectory: options.cachePathDirectory
    });
    await loadAndSaveNodesToCache({
        refreshTransferrableNodes: options.refreshTransferrableNodes,
        cachePathDirectory: options.cachePathDirectory
    });
    await loadAndSavePathsToCache(options.cachePathDirectory);
    console.log('all cache save complete');
};
