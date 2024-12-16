/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { EventEmitter } from 'events';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';

import { SimulationAlgorithm } from 'transition-common/lib/services/simulation/SimulationAlgorithm';
import SimulationRun from './SimulationRun';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import config from 'chaire-lib-backend/lib/config/server.config';

/**
 * A factory to create a simulation algorithm object with the given parameters.
 *
 * @export
 * @interface SimulationAlgorithm
 */
export type SimulationAlgorithmFactory<T> = (options: T, simulationRun: SimulationRun) => SimulationAlgorithm;

const ALGORITHMS_FACTORY: { [key: string]: SimulationAlgorithmFactory<any> } = {};
export const registerAlgorithmFactory = (name: string, algorithmFactory: SimulationAlgorithmFactory<any>): void => {
    ALGORITHMS_FACTORY[name] = algorithmFactory;
};

const loadServerData = async (
    socket: EventEmitter
): Promise<{ lines: LineCollection; agencies: AgencyCollection; services: ServiceCollection }> => {
    const collectionManager = new CollectionManager(undefined);
    const lines = new LineCollection([], {});
    const agencies = new AgencyCollection([], {});
    const services = new ServiceCollection([], {});
    const paths = new PathCollection([], {});
    const nodes = new NodeCollection([], {});
    await paths.loadFromServer(socket);
    collectionManager.add('paths', paths);
    await nodes.loadFromServer(socket);
    collectionManager.add('nodes', nodes);
    await lines.loadFromServer(socket, collectionManager);
    collectionManager.add('lines', lines);
    await agencies.loadFromServer(socket, collectionManager);
    collectionManager.add('agencies', agencies);
    await services.loadFromServer(socket, collectionManager);
    collectionManager.add('services', services);
    return { lines, agencies, services };
};

const prepareCacheDirectory = function (simulationRun: SimulationRun) {
    const projectRelativeCacheDirectoryPath = simulationRun.getProjectRelativeCacheDirectoryPath();

    // TODO: make sure we copy every files, even new files like stations and stops.

    console.log('Preparing and copying cache files...');
    fileManager.directoryManager.copyDirectory(
        `cache/${config.projectShortname}/dataSources`,
        `${projectRelativeCacheDirectoryPath}/datasources`,
        true
    );
    fileManager.directoryManager.copyDirectory(
        `cache/${config.projectShortname}/nodes`,
        `${projectRelativeCacheDirectoryPath}/nodes`,
        true
    );
    fileManager.directoryManager.copyDirectory(
        `cache/${config.projectShortname}/lines`,
        `${projectRelativeCacheDirectoryPath}/lines`,
        true
    );
    fileManager.copyFile(
        `cache/${config.projectShortname}/dataSources.capnpbin`,
        `${projectRelativeCacheDirectoryPath}/dataSources.capnpbin`,
        true
    );
    fileManager.copyFile(
        `cache/${config.projectShortname}/agencies.capnpbin`,
        `${projectRelativeCacheDirectoryPath}/agencies.capnpbin`,
        true
    );
    fileManager.copyFile(
        `cache/${config.projectShortname}/lines.capnpbin`,
        `${projectRelativeCacheDirectoryPath}/lines.capnpbin`,
        true
    );
    fileManager.copyFile(
        `cache/${config.projectShortname}/paths.capnpbin`,
        `${projectRelativeCacheDirectoryPath}/paths.capnpbin`,
        true
    );
    fileManager.copyFile(
        `cache/${config.projectShortname}/nodes.capnpbin`,
        `${projectRelativeCacheDirectoryPath}/nodes.capnpbin`,
        true
    );
    fileManager.copyFile(
        `cache/${config.projectShortname}/scenarios.capnpbin`,
        `${projectRelativeCacheDirectoryPath}/scenarios.capnpbin`,
        true
    );
    fileManager.copyFile(
        `cache/${config.projectShortname}/services.capnpbin`,
        `${projectRelativeCacheDirectoryPath}/services.capnpbin`,
        true
    );
    console.log(`Prepared cache directory files to ${projectRelativeCacheDirectoryPath}`);
};

const cleanupCacheData = async (simulationRun: SimulationRun) => {
    console.log('Cleaning data...');
    console.log(
        `Deleting custom cache directory for this simulation run in ${simulationRun.getProjectRelativeCacheDirectoryPath()}...`
    );
    fileManager.directoryManager.deleteDirectory(simulationRun.getProjectRelativeCacheDirectoryPath());
};

export const runSimulation = async (simulationRun: SimulationRun, socket: EventEmitter): Promise<boolean> => {
    if (simulationRun.attributes.status !== 'notStarted') {
        throw new TrError('Simulation is already started', 'SIMRUN001');
    }

    simulationRun.attributes.status = 'pending';
    await simulationRun.save(socket);

    const factory = ALGORITHMS_FACTORY[simulationRun.attributes.data.algorithmConfiguration.type];
    if (factory === undefined) {
        throw new TrError(
            `Factory for algorithm ${simulationRun.attributes.data.algorithmConfiguration.type} is not defined`,
            'SIMRUN002'
        );
    }

    const { agencies, lines, services } = await loadServerData(socket);
    const algorithm = factory(simulationRun.attributes.data.algorithmConfiguration.config, simulationRun);
    try {
        prepareCacheDirectory(simulationRun);
        await algorithm.run(socket, { agencies, lines, services });
        await simulationRun.save(socket);
    } catch (error) {
        console.error('Error running simulation: ', error);
        simulationRun.attributes.status = 'failed';
        await simulationRun.save(socket);
    } finally {
        // Cleanup cache data
        await cleanupCacheData(simulationRun);
    }

    return true;
};
