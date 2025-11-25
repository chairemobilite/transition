/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import EventEmitter from "events";

import config from 'chaire-lib-backend/lib/config/server.config';
import CollectionManager from "chaire-lib-common/lib/utils/objects/CollectionManager";
import AgencyCollection from "transition-common/lib/services/agency/AgencyCollection";
import LineCollection from "transition-common/lib/services/line/LineCollection";
import NodeCollection from "transition-common/lib/services/nodes/NodeCollection";
import PathCollection from "transition-common/lib/services/path/PathCollection";
import ServiceCollection from "transition-common/lib/services/service/ServiceCollection";
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { ExecutableJob } from "../../executableJob/ExecutableJob";
import { JobDataType } from "transition-common/lib/services/jobs/Job";
import { TransitNetworkDesignJobType } from "./types";
import { LineServices } from "../../evolutionaryAlgorithm/internalTypes";
import { TransitNetworkDesignAlgorithm } from "transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm";
import { AlgorithmType } from "transition-common/lib/services/networkDesign/transit/algorithm";
import { evolutionaryAlgorithmFactory } from "../../evolutionaryAlgorithm";

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

// Type to extract parameters from a job data type
type ExtractParameters<TJobType extends JobDataType> = TJobType extends { data: { parameters: infer P } } ? P : never;

/**
 * Wrapper around a transit network design job to provide easy access to and
 * save a few extra runtime data like object collections
 *
 * FIXME Tried doing a class that extends ExecutableJob<TJobType> but ran into
 * problem with typing the type. There is a generic TransitNetworkDesignJob that
 * could define the parameter types, but all the rest is algorithm specific
 * (results, internal data, files), so instead, we have a wrapper around the
 * job and use specific types when necessary. See if it's the best way.
 */
export class TransitNetworkDesignJobWrapper<TJobType extends TransitNetworkDesignJobType = TransitNetworkDesignJobType> {
    
    private _lineCollection: LineCollection | undefined = undefined;
    private _agencyCollection: AgencyCollection | undefined = undefined;
    private _serviceCollection: ServiceCollection | undefined = undefined;
    private _lineServices: LineServices | undefined = undefined;

    constructor(private wrappedJob: ExecutableJob<TJobType>) {
        // Nothing to do
    }

    get parameters(): ExtractParameters<TJobType> {
        return this.wrappedJob.attributes.data.parameters as ExtractParameters<TJobType>;
    }

    get job(): ExecutableJob<TJobType> {
        return this.wrappedJob;
    }

    get lineCollection(): LineCollection {
        if (this._lineCollection === undefined) {
            throw new Error('Line collection not loaded yet');
        }
        return this._lineCollection;
    }

    get agencyCollection(): AgencyCollection {
        if (this._agencyCollection === undefined) {
            throw new Error('Line collection not loaded yet');
        }
        return this._agencyCollection;
    }


    get serviceCollection(): ServiceCollection {
        if (this._serviceCollection === undefined) {
            throw new Error('Line collection not loaded yet');
        }
        return this._serviceCollection;
    }


    get lineServices(): LineServices {
        if (this._lineServices === undefined) {
            throw new Error('Line services not set yet');
        }
        return this._lineServices;
    }

    setLineServices(lineServices: LineServices) {
        this._lineServices = lineServices;
    }

    getCacheDirectory = (): string => {
        return this.wrappedJob.getJobFileDirectory() + '/cache/';
    }

    loadServerData = async (
        socket: EventEmitter
    ): Promise<void> => {
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
        this._lineCollection   = lines;
        this._agencyCollection = agencies;
        this._serviceCollection = services;
    };
    
    /**
     * Copy the current cache to the job's cache directory
     * @param job 
     */
    prepareCacheDirectory = () => {
        const absoluteCacheDirectory = this.getCacheDirectory();
        const mainCacheDirectory = `${fileManager.directoryManager.cacheDirectory}/${config.projectShortname}`;
    
        // TODO: make sure we copy every files, even new files like stations and stops.
    
        console.log('Preparing and copying cache files...');
        fileManager.directoryManager.copyDirectoryAbsolute(
            `${mainCacheDirectory}/dataSources`,
            `${absoluteCacheDirectory}/datasources`,
            true
        );
        fileManager.directoryManager.copyDirectory(
            `${mainCacheDirectory}/nodes`,
            `${absoluteCacheDirectory}/nodes`,
            true
        );
        fileManager.directoryManager.copyDirectory(
            `${mainCacheDirectory}/lines`,
            `${absoluteCacheDirectory}/lines`,
            true
        );
        fileManager.copyFile(
            `${mainCacheDirectory}/dataSources.capnpbin`,
            `${absoluteCacheDirectory}/dataSources.capnpbin`,
            true
        );
        fileManager.copyFile(
            `${mainCacheDirectory}/agencies.capnpbin`,
            `${absoluteCacheDirectory}/agencies.capnpbin`,
            true
        );
        fileManager.copyFile(
            `${mainCacheDirectory}/lines.capnpbin`,
            `${absoluteCacheDirectory}/lines.capnpbin`,
            true
        );
        fileManager.copyFile(
            `${mainCacheDirectory}/paths.capnpbin`,
            `${absoluteCacheDirectory}/paths.capnpbin`,
            true
        );
        fileManager.copyFile(
            `${mainCacheDirectory}/nodes.capnpbin`,
            `${absoluteCacheDirectory}/nodes.capnpbin`,
            true
        );
        fileManager.copyFile(
            `${mainCacheDirectory}/scenarios.capnpbin`,
            `${absoluteCacheDirectory}/scenarios.capnpbin`,
            true
        );
        fileManager.copyFile(
            `${mainCacheDirectory}/services.capnpbin`,
            `${absoluteCacheDirectory}/services.capnpbin`,
            true
        );
        console.log(`Prepared cache directory files to ${absoluteCacheDirectory}`);
    };
}