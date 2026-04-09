/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import EventEmitter from 'events';
import random from 'random';
import _cloneDeep from 'lodash/cloneDeep';
import fs from 'fs';
import path from 'path';
import { unparse } from 'papaparse';

import config from 'chaire-lib-backend/lib/config/server.config';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import Line from 'transition-common/lib/services/line/Line';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { ExecutableJob } from '../../executableJob/ExecutableJob';
import { JobDataType } from 'transition-common/lib/services/jobs/Job';
import { TransitNetworkDesignJobType } from './types';
import { LineServices } from '../../evolutionaryAlgorithm/internalTypes';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import { MemcachedInstance } from 'chaire-lib-backend/lib/utils/processManagers/MemcachedProcessManager';

import { TrRoutingBatchManager, TrRoutingBatchStartResult } from '../../transitRouting/TrRoutingBatchManager';
import { FakeTrRoutingBatchManager } from '../../transitRouting/FakeTrRoutingBatchManager';
import { parseCsvFile as parseCsvFileFromStream } from 'chaire-lib-common/lib/utils/files/CsvFile';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { OdTripSimulationOptions } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import { BatchRouteJobType } from '../../transitRouting/BatchRoutingJob';
import { OdTripSimulationDemandFromCsvAttributes } from 'transition-common/lib/services/networkDesign/transit/simulationMethod/OdTripSimulationMethod';
import { TransitDemandFromCsvRoutingAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TrRoutingBatchExecutor } from '../../transitRouting/TrRoutingBatch';
import { OdTripComparisonFitnessVisitor } from '../../simulation/methods/OdTripSimulation';
import {
    getNonRoutableOdTripFitnessFunction,
    getOdTripFitnessFunction
} from '../../simulation/methods/OdTripSimulationFitnessFunctions';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

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
    private _collectionManager: CollectionManager | undefined = undefined;
    protected memcachedInstance: MemcachedInstance | undefined | null = undefined;
    private _trRoutingBatchStartResult: TrRoutingBatchStartResult | undefined = undefined;
    // For each OD trip of the array, saves 2 numbers: the fitness score for the base scenario, as well as the non-routed fitness score that will be constant for all scenarios.
    private _originalFitnesses: [number | undefined, number][] | undefined = undefined;
    // Node weights loaded from the job's optional CSV, keyed by node UUID.
    // Kept separate from the node collection so they don't leak into the rest of Transition.
    private _nodeWeightsByUuid: Map<string, number> | undefined = undefined;

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

    get collectionManager(): CollectionManager {
        if (this._collectionManager === undefined) {
            throw new Error('Collection manager not set yet');
        }
        return this._collectionManager;
    }

    setLineServices(lineServices: LineServices) {
        this._lineServices = lineServices;
    }

    getCacheDirectory = (): string => {
        return this.wrappedJob.getJobFileDirectory() + 'cache';
    };

    getMemcachedInstance = (): MemcachedInstance | undefined | null => {
        return this.memcachedInstance;
    };

    setTrRoutingBatchStartResult(startResult: TrRoutingBatchStartResult) {
        this._trRoutingBatchStartResult = startResult;
    }

    getFakeTrRoutingBatchManager(progressEmitter: EventEmitter): TrRoutingBatchManager {
        if (this._trRoutingBatchStartResult) {
            return new FakeTrRoutingBatchManager(
                progressEmitter,
                this._trRoutingBatchStartResult.threadCount,
                this._trRoutingBatchStartResult.port
            );
        } else {
            throw new Error('Fake trRoutingBatchManager not set yet');
        }
    }
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
        this._collectionManager = collectionManager;

        await this.loadNodeWeightsFromCsv();
    };

    /**
     * Parse the optional node weight CSV attached to the job and store the
     * weights in a private map (not on the node collection, so they stay
     * scoped to this job and don't leak into the rest of Transition).
     */
    private loadNodeWeightsFromCsv = async (): Promise<void> => {
        const params = this.parameters;
        if (params.simulationMethod?.type !== 'OdTripSimulation') {
            return;
        }
        const nodeWeightConfig = (params.simulationMethod.config as OdTripSimulationOptions).nodeWeightAttributes;
        if (!nodeWeightConfig || !this.wrappedJob.hasFile('nodeWeight' as keyof TJobType['files'])) {
            return;
        }

        const fieldMappings = nodeWeightConfig.fileAndMapping.fieldMappings;
        const csvStream = this.wrappedJob.getReadStream('nodeWeight' as keyof TJobType['files']);
        const weightMap = new Map<string, number>();

        await parseCsvFileFromStream(
            csvStream,
            (row) => {
                const nodeUuid = row[fieldMappings.nodeUuid];
                const weightStr = row[fieldMappings.weight];
                if (!nodeUuid || weightStr === undefined) {
                    return;
                }
                const weight = parseFloat(weightStr);
                if (!isNaN(weight)) {
                    weightMap.set(nodeUuid, weight);
                }
            },
            { header: true }
        );

        this._nodeWeightsByUuid = weightMap;
        console.log(`Loaded ${weightMap.size} node weights from CSV`);
    };

    /**
     * Compute the weight of a line for vehicle allocation in the GA.
     * Formula: (sum of node weights along all paths) × (cycle time seconds).
     * Node weights come from the job's CSV if provided, defaulting to 1.
     * The GA normalizes across all candidate lines so the result is relative.
     *
     * Path data is resolved from the wrapper's collection manager (via
     * path_ids) rather than line.paths, which can be empty when lines are
     * loaded from cache without the job's collection manager.
     */
    getLineWeight = (line: Line): number | null => {
        const pathFeatures = this.resolvePathFeatures(line);
        if (pathFeatures.length === 1) {
            const totalWeight = this.sumNodeWeights(pathFeatures[0].properties.nodes);
            const cycleTimeSeconds = pathFeatures[0].properties.data?.totalTravelTimeWithReturnBackSeconds;
            if (totalWeight && cycleTimeSeconds) {
                return totalWeight * cycleTimeSeconds;
            }
        } else if (pathFeatures.length === 2) {
            const dir0 = pathFeatures[0].properties.direction;
            const dir1 = pathFeatures[1].properties.direction;
            if ((dir0 === 'outbound' && dir1 === 'inbound') || (dir0 === 'inbound' && dir1 === 'outbound')) {
                const firstPathWeight = this.sumNodeWeights(pathFeatures[0].properties.nodes);
                const secondPathWeight = this.sumNodeWeights(pathFeatures[1].properties.nodes);
                const cycleTimeSeconds =
                    (pathFeatures[0].properties.data?.operatingTimeWithoutLayoverTimeSeconds || 0) +
                    (pathFeatures[1].properties.data?.operatingTimeWithoutLayoverTimeSeconds || 0);
                if (firstPathWeight && secondPathWeight && cycleTimeSeconds) {
                    return (firstPathWeight + secondPathWeight) * cycleTimeSeconds;
                }
            }
        }
        return null;
    };

    /**
     * Look up the GeoJSON path features for a line from the wrapper's
     * collection manager. When the line comes from Cap'n Proto cache
     * (resume), path_ids may be missing; in that case, fall back to
     * the server-loaded line collection to retrieve them.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private resolvePathFeatures = (line: Line): GeoJSON.Feature<any, Record<string, any>>[] => {
        let pathIds = line.attributes.path_ids || [];
        if (pathIds.length === 0 && this._lineCollection) {
            const serverLine = this._lineCollection.getById(line.getId());
            if (serverLine) {
                pathIds = serverLine.attributes.path_ids || [];
            }
        }
        const pathsCollection = this._collectionManager?.get('paths');
        if (!pathsCollection || pathIds.length === 0) {
            return [];
        }
        return pathIds
            .map((pathId: string) => pathsCollection.getById(pathId))
            .filter(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (p: any): p is GeoJSON.Feature<any, Record<string, any>> => p !== undefined && p.properties !== null
            );
    };

    private sumNodeWeights = (nodeIds: string[] | undefined): number => {
        let total = 0;
        (nodeIds || []).forEach((nodeId) => {
            total += this._nodeWeightsByUuid?.get(nodeId) ?? 1;
        });
        return total;
    };

    /**
     * Log a breakdown of line weights for a set of candidate lines:
     * cycle time, raw node weight sum, normalized node weight, and
     * final line weight (cycle time × node weight sum).
     */
    logLineWeightsBreakdown = (candidateLines: Line[]): void => {
        const breakdown = candidateLines.map((line) => {
            const pathFeatures = this.resolvePathFeatures(line);
            let nodeWeightSum = 0;
            let cycleTimeSeconds = 0;

            if (pathFeatures.length === 1) {
                nodeWeightSum = this.sumNodeWeights(pathFeatures[0].properties.nodes);
                cycleTimeSeconds = pathFeatures[0].properties.data?.totalTravelTimeWithReturnBackSeconds || 0;
            } else if (pathFeatures.length === 2) {
                nodeWeightSum =
                    this.sumNodeWeights(pathFeatures[0].properties.nodes) +
                    this.sumNodeWeights(pathFeatures[1].properties.nodes);
                cycleTimeSeconds =
                    (pathFeatures[0].properties.data?.operatingTimeWithoutLayoverTimeSeconds || 0) +
                    (pathFeatures[1].properties.data?.operatingTimeWithoutLayoverTimeSeconds || 0);
            }

            return {
                shortname: line.attributes.shortname || line.getId(),
                cycleTimeSeconds,
                nodeWeightSum,
                lineWeight: this.getLineWeight(line) ?? 1
            };
        });

        breakdown.sort((a, b) => b.lineWeight - a.lineWeight);

        const totalNodeWeight = breakdown.reduce((sum, b) => sum + b.nodeWeightSum, 0);
        const totalLineWeight = breakdown.reduce((sum, b) => sum + b.lineWeight, 0);

        console.log('--- Line Weights Breakdown ---');
        for (const b of breakdown) {
            const normalizedNodeWeight = totalNodeWeight > 0 ? b.nodeWeightSum / totalNodeWeight : 0;
            console.log(
                `Line ${b.shortname}: ` +
                    `cycleTime=${b.cycleTimeSeconds}s, ` +
                    `nodeWeight=${b.nodeWeightSum.toFixed(2)}, ` +
                    `normalizedNodeWeight=${normalizedNodeWeight.toFixed(4)}, ` +
                    `lineWeight=${b.lineWeight.toFixed(2)} ` +
                    `(${totalLineWeight > 0 ? ((b.lineWeight / totalLineWeight) * 100).toFixed(1) : 0}%)`
            );
        }
        console.log(`Total: nodeWeight=${totalNodeWeight.toFixed(2)}, lineWeight=${totalLineWeight.toFixed(2)}`);
        console.log('--- End Line Weights ---');
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

        this.addCacheSymlink();

        console.log(`Prepared cache directory files to ${absoluteCacheDirectory} from ${mainCacheDirectory}`);
    };

    addCacheSymlink = () => {
        const absoluteCacheDirectory = this.getCacheDirectory();
        const mainCacheDirectory = `${fileManager.directoryManager.cacheDirectory}/${config.projectShortname}`;

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

            // Remove existing entry at the symlink path. On macOS,
            // fs.unlinkSync fails with EPERM on directories, so we need to
            // distinguish between symlinks and real directories using lstatSync.
            if (fs.existsSync(symlinkPath)) {
                const stat = fs.lstatSync(symlinkPath);
                if (stat.isSymbolicLink()) {
                    fs.unlinkSync(symlinkPath);
                } else if (stat.isDirectory()) {
                    fs.rmSync(symlinkPath, { recursive: true });
                } else {
                    fs.unlinkSync(symlinkPath);
                }
            }

            // Create symbolic link pointing to the job cache directory
            fs.symlinkSync(absoluteCacheDirectory, symlinkPath, 'dir');

            console.log(`Created symbolic link: ${symlinkPath} -> ${absoluteCacheDirectory}`);
        } catch (error) {
            console.warn(`Failed to create symbolic link: ${error}`);
        }
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

    private async getBaseScenarioJob(scenarioId: string | undefined): Promise<ExecutableJob<BatchRouteJobType>> {
        // See if a job already exists, if so, load and return it
        await this.job.refresh();
        const batchRoutingJobId = (this.job.attributes.internal_data as any).baseScenarioBatchRoutingJobId;
        if (batchRoutingJobId) {
            const batchRoutingJob = await ExecutableJob.loadTask<BatchRouteJobType>(batchRoutingJobId);
            if (batchRoutingJob) {
                console.log(
                    `Found existing batch routing job for base scenario with id ${batchRoutingJobId}, resuming it`
                );
                return batchRoutingJob;
            }
        }

        const parameters = this.wrappedJob.attributes.data.parameters;

        // For the simulation method, run on 100% of the sample
        const methodOptions = parameters.simulationMethod;

        // FIXME The rest of this method was copy pasted and adapted from
        // OdTripSimulation. If we decide to keep differential fitness, we
        // should refactor the simulation methods, such that we can re-use code
        // between here and the various simulation methods (not just the od trip
        // simulation).
        const odTripSimulationOptions = methodOptions.config as OdTripSimulationOptions;

        // Need to build a BatchCalculationParameters for the BatchRouteJobType
        // It's composed TransitRoutingQueryAttributes plus the withGeometries, detailed flag
        // The TransitRoutingQueryAttributes is a RoutingQueryAttributes + TransitQueryAttributes
        // The TransitQueryAttributes is a TransitRoutingBaseAttributes (coming from options.transitRoutingAttributes)
        // and a scenarioId. The RoutingQueryAttributes is the routingModes and the withAlternatives flag.
        const batchParams: BatchCalculationParameters = {
            ...odTripSimulationOptions.transitRoutingAttributes,
            // Calculate walking and driving for all, add transit if there's a comparison scenario to use
            routingModes: scenarioId === undefined ? ['walking', 'driving'] : ['transit', 'walking', 'driving'],
            withAlternatives: false,
            withGeometries: false,
            detailed: false,
            scenarioId: scenarioId
        };

        // Fetch memcached information from global job
        const memcachedServer = this.getMemcachedInstance()?.getServer();

        // We use arbitrary times between 8 and 9 am for the simulation, to better capture the differences between scenarios. The time field and format are defined here
        const demandAttributes = _cloneDeep(
            odTripSimulationOptions.demandAttributes
        ) as OdTripSimulationDemandFromCsvAttributes;
        const demandFieldMapping = demandAttributes.fileAndMapping
            .fieldMappings as TransitDemandFromCsvRoutingAttributes;
        // Add the time, time type and format to the demand attributes, as they are not defined or even required in the main job
        demandFieldMapping.time = 'time';
        demandFieldMapping.timeFormat = 'secondsSinceMidnight';
        demandFieldMapping.timeType = 'departure';

        // Create the batch routing job as a child of the current job
        const routingJob: ExecutableJob<BatchRouteJobType> = await this.job.createChildJob({
            name: 'batchRoute', //TODO Is this important, can I rename it do something else ???
            data: {
                parameters: {
                    demandAttributes: demandFieldMapping,
                    transitRoutingAttributes: batchParams,
                    // Use normal cache directory for this batch job
                    trRoutingJobParameters: { memcachedServer }
                }
            },
            resources: {
                // Input file will be prepared later
                files: { input: 'transit_demand_for_base_scenario.csv' }
            }
        });

        // FIXME Copied form OdTripSimulation and hardcoding for now
        const sampleOdTripFileForJob = (): Promise<void> => {
            return new Promise<void>((resolve, reject) => {
                // Complete input file from the parent job
                const csvStream = this.job.getReadStream('transitDemand');

                // Prepare the sampled file for the child job
                const writeStream = routingJob.getWriteStream('input');
                let needWriteHeader = true;
                parseCsvFileFromStream(
                    csvStream,
                    (line) => {
                        // Give a random trip time in the time range, in seconds since midnight
                        line['time'] = random.integer(
                            8 * 3600, // FIXME Magic, but will be refactored if we keep the differential fitness
                            9 * 3600
                        );
                        // Need to manually add the trailing newline since papaparse
                        // unparse does not add it automatically
                        writeStream.write(unparse([line], { header: needWriteHeader, newline: '\n' }) + '\n');
                        needWriteHeader = false;
                    },
                    { header: true }
                )
                    .then(() => {
                        writeStream.end(() => {
                            resolve();
                        });
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        };
        // Create the input file for the batch routing job with all data
        await sampleOdTripFileForJob();

        // Job ready to run, save it in internal_data of the parent job so it can be accessed by the simulation method
        await this.job.refresh();
        // FIXME Type this if we keep this
        (this.job.attributes.internal_data as any).baseScenarioBatchRoutingJobId = routingJob.id;
        this.job.save(this.executorOptions.progressEmitter);
        return routingJob;
    }

    // Run the simulation on the base scenario, on 100% of the sample, if a
    // scenario is set. This also runs the walking and driving modes for all od
    // trips, so there is no need to calculate them at each simulation and it
    // saves on total calculation time.
    //
    // FIXME This is only for the OdTripSimulation, it does not belong in this
    // class. When refactoring to main, we should provide a way for simulation
    // methods to do some once-in-a-job task like this and care for their own
    // fougères after (ie the original fitnesses)
    runBaseScenario = async (): Promise<number[] | undefined> => {
        const parameters = this.wrappedJob.attributes.data.parameters;
        const shouldCompareWithScenario = parameters.transitNetworkDesignParameters.shouldCompareWithCurrentScenario;
        const scenarioToCompare = parameters.transitNetworkDesignParameters.scenarioToCompare;

        if (shouldCompareWithScenario === true && _isBlank(scenarioToCompare)) {
            throw new TrError(
                'A scenario to compare with the current scenario must be selected',
                'SIOMSCEN005',
                'transit:simulation:errors:CompareWithCurrentScenarioInvalid'
            );
        }

        // Works only for odTripSimulation method
        const methodOptions = parameters.simulationMethod;
        if (methodOptions.type !== 'OdTripSimulation') {
            console.log('Base scenario simulation is only implemented for OdTripSimulation method, skipping');
            return undefined;
        }

        // Child job needs its own progress emitter to avoid conflicts with the parent's
        const routingJob = await this.getBaseScenarioJob(shouldCompareWithScenario ? scenarioToCompare : undefined);

        const childProgressEmitter = new EventEmitter();

        const batchJobExecutor = new TrRoutingBatchExecutor(routingJob, {
            progressEmitter: childProgressEmitter,
            isCancelled: this.executorOptions.isCancelled
        });

        if (routingJob.status === 'completed') {
            console.log('Batch routing job for base scenario simulation already completed, skipping');
        } else {
            // Run the job and wait for it to complete.
            console.log('Starting batch routing job for base scenario simulation');
            console.time('Batch routing job for base scenario simulation');

            // Set in progress and run the job.
            routingJob.setInProgress();
            routingJob.save(this.executorOptions.progressEmitter);
            const execResults = await batchJobExecutor.run();
            if (execResults.completed !== true) {
                throw new Error('Batch routing job for base scenario simulation did not complete successfully');
            }

            // Set the job as completed
            // FIXME refresh/update/save should be done by a single function
            await routingJob.refresh();
            routingJob.setCompleted();
            routingJob.save(this.executorOptions.progressEmitter);
            console.timeEnd('Batch routing job for base scenario simulation');
        }

        // Visit the job to get the fitness scores for all values
        const odTripSimulationOptions = this.job.attributes.data.parameters.simulationMethod
            .config as OdTripSimulationOptions;
        const visitor = new OdTripComparisonFitnessVisitor({
            odTripFitnessFunction: getOdTripFitnessFunction(
                odTripSimulationOptions.evaluationOptions.odTripFitnessFunction
            ),
            // FIXME This is hardcoded in the OdTripSimulation too
            nonRoutableOdTripFitnessFunction: getNonRoutableOdTripFitnessFunction('taxi'),
            hasTransit: shouldCompareWithScenario === true
        });
        this._originalFitnesses = await batchJobExecutor.handleResults(visitor);
    };

    getOriginalFitness = (index: number): [number | undefined, number] | undefined => {
        if (this._originalFitnesses === undefined) {
            return undefined;
        }
        return this._originalFitnesses[index];
    };
}
