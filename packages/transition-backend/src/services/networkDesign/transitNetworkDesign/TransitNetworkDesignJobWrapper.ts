/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

import config from 'chaire-lib-backend/lib/config/server.config';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { ExecutableJob } from '../../executableJob/ExecutableJob';
import { JobDataType } from 'transition-common/lib/services/jobs/Job';
import { TransitNetworkDesignJobType } from './types';
import { LineServices } from '../../evolutionaryAlgorithm/internalTypes';
import { TranslatableMessage } from "chaire-lib-common/lib/utils/TranslatableMessage";

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
export class TransitNetworkDesignJobWrapper<
    TJobType extends TransitNetworkDesignJobType = TransitNetworkDesignJobType
> {
    private _lineCollection: LineCollection | undefined = undefined;
    private _simulatedLineCollection: LineCollection | undefined = undefined;
    private _agencyCollection: AgencyCollection | undefined = undefined;
    private _serviceCollection: ServiceCollection | undefined = undefined;
    private _lineServices: LineServices | undefined = undefined;

    constructor(
        private wrappedJob: ExecutableJob<TJobType>,
        protected executorOptions: {
            progressEmitter: EventEmitter;
            isCancelled: () => boolean;
        }
    ) {
        // Nothing to do
    }

    get parameters(): ExtractParameters<TJobType> {
        return this.wrappedJob.attributes.data.parameters as ExtractParameters<TJobType>;
    }

    get job(): ExecutableJob<TJobType> {
        // FIXME Make sure the 5 seconds polling from the TransitionWorkerPool updates this job object, otherwise, it needs to be refreshed from time to time
        return this.wrappedJob;
    }

    // TODO temp to pass it in OdTripSimulation, check if it's the right way...
    get privexecutorOptions() {
        return this.executorOptions;
    }

    get allLineCollection(): LineCollection {
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

    get simulatedLineCollection(): LineCollection {
        if (this._simulatedLineCollection === undefined) {
            throw new Error('Line collection not set yet');
        }
        return this._simulatedLineCollection;
    }

    set simulatedLineCollection(lineCollection: LineCollection) {
        this._simulatedLineCollection = lineCollection;
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
        return this.wrappedJob.getJobFileDirectory() + 'cache';
    };

    loadServerData = async (socket: EventEmitter): Promise<void> => {
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
        this._lineCollection = lines;
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
            `${absoluteCacheDirectory}/dataSources`,
            true
        );
        fileManager.directoryManager.copyDirectoryAbsolute(
            `${mainCacheDirectory}/nodes`,
            `${absoluteCacheDirectory}/nodes`,
            true
        );
        fileManager.directoryManager.copyDirectoryAbsolute(
            `${mainCacheDirectory}/lines`,
            `${absoluteCacheDirectory}/lines`,
            true
        );
        fileManager.copyFileAbsolute(
            `${mainCacheDirectory}/dataSources.capnpbin`,
            `${absoluteCacheDirectory}/dataSources.capnpbin`,
            true
        );
        fileManager.copyFileAbsolute(
            `${mainCacheDirectory}/agencies.capnpbin`,
            `${absoluteCacheDirectory}/agencies.capnpbin`,
            true
        );
        fileManager.copyFileAbsolute(
            `${mainCacheDirectory}/lines.capnpbin`,
            `${absoluteCacheDirectory}/lines.capnpbin`,
            true
        );
        fileManager.copyFileAbsolute(
            `${mainCacheDirectory}/paths.capnpbin`,
            `${absoluteCacheDirectory}/paths.capnpbin`,
            true
        );
        fileManager.copyFileAbsolute(
            `${mainCacheDirectory}/nodes.capnpbin`,
            `${absoluteCacheDirectory}/nodes.capnpbin`,
            true
        );
        fileManager.copyFileAbsolute(
            `${mainCacheDirectory}/scenarios.capnpbin`,
            `${absoluteCacheDirectory}/scenarios.capnpbin`,
            true
        );
        fileManager.copyFileAbsolute(
            `${mainCacheDirectory}/services.capnpbin`,
            `${absoluteCacheDirectory}/services.capnpbin`,
            true
        );
        // FIXME HACK Add a symlink from mainCacheDirectory to the job cache
        // directory because the path in the json to capnp server is relative to
        // main cache path Create symbolic link pointing to the job cache
        // directory Add a symbolic link such that mainCacheDirectory + all
        // directory hierarchy points to the job cache directory
        try {
            // Create the full path structure inside mainCacheDirectory
            const symlinkPath = path.join(mainCacheDirectory, absoluteCacheDirectory);

            // Ensure the parent directory exists
            const symlinkParentDir = path.dirname(symlinkPath);
            if (!fs.existsSync(symlinkParentDir)) {
                fs.mkdirSync(symlinkParentDir, { recursive: true });
            }

            // Remove existing symlink if it exists
            if (fs.existsSync(symlinkPath)) {
                fs.unlinkSync(symlinkPath);
            }

            // Create symbolic link pointing to the job cache directory
            fs.symlinkSync(absoluteCacheDirectory, symlinkPath, 'dir');

            console.log(`Created symbolic link: ${symlinkPath} -> ${absoluteCacheDirectory}`);
        } catch (error) {
            console.warn(`Failed to create symbolic link: ${error}`);
        }

        console.log(`Prepared cache directory files to ${absoluteCacheDirectory} from ${mainCacheDirectory}`);
    };

    async addMessages(messages: {
        warnings?: TranslatableMessage[];
        errors?: TranslatableMessage[];
        infos?: TranslatableMessage[];
    }): Promise<void> {
        // Quick return if no message to set
        if (
            (messages.warnings === undefined || messages.warnings.length === 0) &&
            (messages.errors === undefined || messages.errors.length === 0) &&
            (messages.infos === undefined || messages.infos.length === 0)
        ) {
            return;
        }
        await this.wrappedJob.refresh();
        const currentMessages = this.wrappedJob.attributes.statusMessages || {};
        const existingErrors = currentMessages.errors || [];
        const existingWarnings = currentMessages.warnings || [];
        const existingInfos = currentMessages.infos || [];

        this.wrappedJob.attributes.statusMessages = {
            errors: [...existingErrors, ...(messages.errors || [])],
            warnings: [...existingWarnings, ...(messages.warnings || [])],
            infos: [...existingInfos, ...(messages.infos || [])]
        };
        await this.wrappedJob.save();
    }
}
