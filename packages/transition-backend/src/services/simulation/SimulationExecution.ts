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

import { TransitNetworkDesignAlgorithm } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import { evolutionaryAlgorithmFactory } from '../evolutionaryAlgorithm';
import SimulationRun from './SimulationRun';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import config from 'chaire-lib-backend/lib/config/server.config';
import { AlgorithmType } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { EvolutionaryTransitNetworkDesignJobType } from '../networkDesign/transitNetworkDesign/evolutionary/types';
import { ExecutableJob } from '../executableJob/ExecutableJob';
import { JobDataType } from 'transition-common/lib/services/jobs/Job';
import { TransitNetworkDesignJobWrapper } from '../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { TransitNetworkDesignJobType } from '../networkDesign/transitNetworkDesign/types';

/**
 * A factory to create a simulation algorithm object with the given parameters.
 *
 * @export
 * @interface TransitNetworkDesignAlgorithm
 */
export type TransitNetworkDesignAlgorithmFactory<T extends TransitNetworkDesignJobType> = (
    jobWrapper: TransitNetworkDesignJobWrapper<T>
) => TransitNetworkDesignAlgorithm;

// Predefined algorithm factories
const ALGORITHMS_FACTORY: { [K in AlgorithmType]: TransitNetworkDesignAlgorithmFactory<any> } = {
    evolutionaryAlgorithm: evolutionaryAlgorithmFactory
};

export const getAlgorithmFactory = <T extends AlgorithmType>(
    algorithmType: T
): TransitNetworkDesignAlgorithmFactory<any> => {
    return ALGORITHMS_FACTORY[algorithmType];
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

    const algorithmType = simulationRun.attributes.data.algorithmConfiguration.type;
    const factory = ALGORITHMS_FACTORY[algorithmType];
    if (factory === undefined) {
        throw new TrError(`Factory for algorithm ${algorithmType} is not defined`, 'SIMRUN002');
    }

    //const { agencies, lines, services } = await loadServerData(socket);
    /*const algorithm = factory(simulationRun.attributes.data.algorithmConfiguration.config, simulationRun);
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
    }*/

    return true;
};
