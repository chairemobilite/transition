/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

import { ExecutableJob } from '../../executableJob/ExecutableJob';
import type {
    EvolutionaryTransitNetworkDesignJob,
    EvolutionaryTransitNetworkDesignJobType
} from './evolutionary/types';
import { EvolutionaryTransitNetworkDesignJobParameters, NODE_WEIGHTS_OUTPUT_FILENAME } from './evolutionary/types';
import {
    resolveNodeWeightingInputFilesForEvolutionaryJob,
    rewriteNodeWeightingCsvFileToJobLocation
} from './nodeWeighting/NodeWeightingFileResolver';
import { TransitNetworkDesignJobWrapper } from './TransitNetworkDesignJobWrapper';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitApi } from 'transition-common/lib/api/transit';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';
import { fileKey } from 'transition-common/lib/services/jobs/Job';
import { ExecutableJobUtils } from '../../executableJob/ExecutableJobUtils';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';

export type LineWeightRow = {
    lineId: string;
    shortname: string;
    totalWeight: number | null;
};

export type LineWeightsForJobResponse = {
    lineWeights: LineWeightRow[];
    hasNodeWeightsFile: boolean;
};

type EvolutionaryInputFiles = {
    [Property in keyof EvolutionaryTransitNetworkDesignJobType[fileKey]]?:
        | string
        | { filepath: string; renameTo: string };
};

async function resolveDemandInputFilesForEvolutionaryJob(
    parameters: EvolutionaryTransitNetworkDesignJobParameters,
    userId: number,
    options?: { requireDemandFile?: boolean }
): Promise<{ inputFiles: EvolutionaryInputFiles; sourceJobId?: number }> {
    const requireDemandFile = options?.requireDemandFile !== false;
    const inputFiles: EvolutionaryInputFiles = {};
    if (parameters.simulationMethod.type !== 'OdTripSimulation') {
        return { inputFiles };
    }

    const demandCsv = parameters.simulationMethod.config.demandAttributes?.fileAndMapping?.csvFile;
    if (demandCsv) {
        inputFiles.transitDemand = await ExecutableJobUtils.prepareJobFiles(demandCsv, userId);
    } else if (requireDemandFile) {
        throw new TrError('Missing demand csv file', 'TRJOBC0001', 'transit:networkDesign.errors.MissingDemandCsvFile');
    }
    const sourceJobId = demandCsv?.location === 'job' ? demandCsv.jobId : undefined;
    return { inputFiles, sourceJobId };
}

async function buildInputFilesForEvolutionaryJob(
    parameters: EvolutionaryTransitNetworkDesignJobParameters,
    userId: number,
    options?: { requireDemandFile?: boolean }
): Promise<EvolutionaryInputFiles> {
    const demandResolution = await resolveDemandInputFilesForEvolutionaryJob(parameters, userId, {
        requireDemandFile: options?.requireDemandFile
    });
    const nodeWeightingInputFiles = await resolveNodeWeightingInputFilesForEvolutionaryJob(parameters, userId, {
        fallbackSourceJobId: demandResolution.sourceJobId
    });
    return { ...demandResolution.inputFiles, ...nodeWeightingInputFiles };
}

async function createEvolutionaryTransitNetworkDesignJob(
    jobParameters: TransitNetworkJobConfigurationType,
    userId: number,
    options?: { requireDemandFile?: boolean }
): Promise<EvolutionaryTransitNetworkDesignJob> {
    const { description, ...parameters } = jobParameters;
    const inputFiles = await buildInputFilesForEvolutionaryJob(parameters, userId, {
        requireDemandFile: options?.requireDemandFile
    });
    const job: EvolutionaryTransitNetworkDesignJob = await ExecutableJob.createJob({
        user_id: userId,
        name: 'evolutionaryTransitNetworkDesign',
        data: {
            parameters,
            description
        },
        inputFiles
    });
    return job;
}

const createAndEnqueueEvolutionaryTransitNetworkDesignJob = async (
    jobParameters: TransitNetworkJobConfigurationType,
    eventEmitter: EventEmitter,
    userId: number,
    existingJobId?: number
) => {
    let job: EvolutionaryTransitNetworkDesignJob;
    if (typeof existingJobId === 'number' && existingJobId > 0) {
        const loaded = await ExecutableJob.loadTask(existingJobId);
        if (loaded.attributes.user_id !== userId) {
            throw new TrError(
                'Not allowed to run this job',
                'TRJOBC0003',
                'transit:networkDesign.errors.NotAllowedToUpdateJob'
            );
        }
        job = loaded as EvolutionaryTransitNetworkDesignJob;
        const { description, ...parameters } = jobParameters;
        job.attributes.data = { ...job.attributes.data, parameters, description };
        const inputFiles = await buildInputFilesForEvolutionaryJob(parameters, userId, { requireDemandFile: false });
        const jobDir = job.getJobFileDirectory();
        for (const [, inputFile] of Object.entries(inputFiles)) {
            if (inputFile === undefined) {
                continue;
            }
            const filePath = typeof inputFile === 'string' ? inputFile : inputFile.filepath;
            const jobFileName = typeof inputFile === 'string' ? path.parse(filePath).base : inputFile.renameTo;
            if (fileManager.fileExistsAbsolute(filePath)) {
                const destPath = path.join(jobDir, jobFileName);
                fileManager.copyFileAbsolute(filePath, destPath, true);
            }
        }
        await job.save();
    } else {
        job = await createEvolutionaryTransitNetworkDesignJob(jobParameters, userId);
    }
    await job.enqueue(eventEmitter); // this will start the job, not good, because if we duplicate, it should not start right away.
    await job.refresh(); // will update the status and id
    return job.attributes.id;
};

export const createAndEnqueueTransitNetworkDesignJob = async (
    jobParameters: TransitNetworkJobConfigurationType,
    eventEmitter: EventEmitter,
    userId: number,
    existingJobId?: number
) => {
    eventEmitter.emit('progress', { name: 'NetworkDesign', progress: null });

    if (jobParameters.algorithmConfiguration.type === 'evolutionaryAlgorithm') {
        return await createAndEnqueueEvolutionaryTransitNetworkDesignJob(
            jobParameters,
            eventEmitter,
            userId,
            existingJobId
        );
    } else {
        throw 'Unsupported algorithm type for transit network design job';
    }
};

/**
 * Save config without running the job: create a new pending job or update an existing one.
 * When existingJobId is provided, updates that job's parameters and input files in place
 * (any status: pending, completed, failed, cancelled). When existingJobId is not provided,
 * creates a new pending job. Returns the job id.
 * FIXME: save config for a job is not the right place to do this. We should have a wrapper around jobs
 * so we can have jobs associated with a simulation run or a simulation config. There is a missing step
 * between creating a simulation and starting its job(s).
 */
export const saveTransitNetworkDesignConfig = async (
    jobParameters: TransitNetworkJobConfigurationType,
    userId: number,
    existingJobId?: number
): Promise<number> => {
    if (jobParameters.algorithmConfiguration.type !== 'evolutionaryAlgorithm') {
        throw new TrError(
            'Unsupported algorithm type for transit network design job',
            'TRJOBC0002',
            'transit:networkDesign.errors.UnsupportedAlgorithmType'
        );
    }

    const isUpdate = typeof existingJobId === 'number' && Number.isInteger(existingJobId) && existingJobId > 0;
    if (isUpdate) {
        const job = await ExecutableJob.loadTask(existingJobId as number);
        if (job.attributes.user_id !== userId) {
            throw new TrError(
                'Not allowed to update this job',
                'TRJOBC0003',
                'transit:networkDesign.errors.NotAllowedToUpdateJob'
            );
        }
        if (job.attributes.name !== 'evolutionaryTransitNetworkDesign') {
            throw new TrError(
                'Job is not an evolutionary transit network design job',
                'TRJOBC0004',
                'transit:networkDesign.errors.InvalidJobType'
            );
        }
        const evolutionaryJob = job as EvolutionaryTransitNetworkDesignJob;
        const jobDir = evolutionaryJob.getJobFileDirectory();
        if (!fs.existsSync(jobDir)) {
            fs.mkdirSync(jobDir, { recursive: true });
        }
        const { description, ...parameters } = jobParameters;
        const inputFiles = await buildInputFilesForEvolutionaryJob(parameters, userId, {
            requireDemandFile: false
        });
        const resourcesFiles: Record<string, string> = { ...(evolutionaryJob.attributes.resources?.files || {}) };
        for (const [inputFileKey, inputFile] of Object.entries(inputFiles)) {
            if (inputFile === undefined) {
                continue;
            }
            const filePath = typeof inputFile === 'string' ? inputFile : inputFile.filepath;
            const jobFileName = typeof inputFile === 'string' ? path.parse(filePath).base : inputFile.renameTo;
            if (fileManager.fileExistsAbsolute(filePath)) {
                const destPath = path.join(jobDir, jobFileName);
                fileManager.copyFileAbsolute(filePath, destPath, true);
                resourcesFiles[inputFileKey] = jobFileName;
            }
        }
        evolutionaryJob.attributes.data = {
            ...evolutionaryJob.attributes.data,
            parameters,
            description
        };
        evolutionaryJob.attributes.resources = { ...evolutionaryJob.attributes.resources, files: resourcesFiles };
        await evolutionaryJob.save();
        return evolutionaryJob.attributes.id;
    }

    const job = await createEvolutionaryTransitNetworkDesignJob(jobParameters, userId, {
        requireDemandFile: false
    });
    return job.attributes.id;
};

export type TransitNetworkDesignReplayResponse = {
    parameters: TransitNetworkJobConfigurationType;
    /** Existing filenames in the job (from resources.files) for display when file input is empty */
    existingFileNames?: Record<string, string>;
};

export const getParametersFromTransitNetworkDesignJob = async (
    jobId: number,
    userId: number
): Promise<TransitNetworkDesignReplayResponse> => {
    const fromJob = await ExecutableJob.loadTask(jobId);
    // TODO We only have one job type for transit network design for now, but update when we have more
    if (fromJob.attributes.name !== 'evolutionaryTransitNetworkDesign') {
        throw 'Requested job is not an evolutionaryTransitNetworkDesign job';
    }
    if (fromJob.attributes.user_id !== userId) {
        throw 'Not allowed to get the data from another user\' job';
    }
    const transitNetworkJob = fromJob as EvolutionaryTransitNetworkDesignJob;
    const clonedParameters = structuredClone(transitNetworkJob.attributes.data.parameters);
    const storedDescription = transitNetworkJob.attributes.data.description;
    const responseParameters: TransitNetworkJobConfigurationType = {
        ...clonedParameters,
        ...(storedDescription !== undefined && { description: storedDescription })
    };
    if (clonedParameters.simulationMethod.type === 'OdTripSimulation') {
        const config = clonedParameters.simulationMethod.config;
        if (config.demandAttributes?.fileAndMapping) {
            config.demandAttributes.fileAndMapping.csvFile = {
                location: 'job',
                jobId,
                fileKey: 'transitDemand'
            };
        }
        rewriteNodeWeightingCsvFileToJobLocation(config, jobId);
    }
    const existingFileNames =
        transitNetworkJob.attributes.resources?.files !== undefined
            ? { ...transitNetworkJob.attributes.resources.files }
            : undefined;
    return { parameters: responseParameters, existingFileNames };
};

/**
 * Load job data with node weights applied and return total node weight per line for the job's line set.
 * Used in the network design panel to show line weights before running the simulation.
 */
export const getLineWeightsForJob = async (
    jobId: number,
    userId: number,
    socket: EventEmitter
): Promise<LineWeightsForJobResponse> => {
    const job = await ExecutableJob.loadTask(jobId);
    if (job.attributes.user_id !== userId) {
        throw new TrError(
            'Not allowed to get line weights for this job',
            'TRJOBC0005',
            'transit:networkDesign.errors.NotAllowedToGetLineWeights'
        );
    }
    if (job.attributes.name !== 'evolutionaryTransitNetworkDesign') {
        throw new TrError(
            'Job is not an evolutionary transit network design job',
            'TRJOBC0004',
            'transit:networkDesign.errors.InvalidJobType'
        );
    }
    const evolutionaryJob = job as EvolutionaryTransitNetworkDesignJob;
    const nodeWeightsPath = path.join(evolutionaryJob.getJobFileDirectory(), NODE_WEIGHTS_OUTPUT_FILENAME);
    const hasNodeWeightsFile = fs.existsSync(nodeWeightsPath);

    const wrapper = new TransitNetworkDesignJobWrapper(evolutionaryJob, {
        progressEmitter: new EventEmitter(),
        isCancelled: () => false
    });
    const onProgress = (messageKey: string) => {
        socket.emit(TransitApi.TRANSIT_NETWORK_DESIGN_LINE_WEIGHTS_PROGRESS, { jobId, messageKey });
    };
    // Use server's event manager so loadFromServer is handled by backend (DB); passing client socket would send to browser and hang
    const serverEventManager = serviceLocator.socketEventManager;
    await wrapper.loadServerData(serverEventManager, onProgress);

    const parameters = evolutionaryJob.attributes.data.parameters;
    const simulatedAgencyIds = parameters?.transitNetworkDesignParameters?.simulatedAgencies ?? [];
    const agencies = simulatedAgencyIds
        .map((agencyId: string) => wrapper.agencyCollection.getById(agencyId))
        .filter((agency): agency is NonNullable<typeof agency> => agency !== null && agency !== undefined);
    const lines = agencies.flatMap((agency) => agency.getLines());

    const lineWeights: LineWeightRow[] = lines.map((line) => ({
        lineId: line.getId(),
        shortname: String(line.get('shortname') ?? line.getId()),
        totalWeight: line.getTotalNodeWeight()
    }));

    return { lineWeights, hasNodeWeightsFile };
};

const LINE_SET_SUMMARY_CSV_FILENAME = 'line_set_summary.csv';
const LINE_SET_SUMMARY_HEADER =
    'line_id,shortname,total_node_weight,total_length_meters,total_cycle_time_seconds,total_weight_x_cycle_time_seconds';

function escapeCsvField(value: string | number | undefined | null): string {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * Build a CSV of the job's line set with total weight, total length and total cycle time
 * for each simple bidirectional symmetric line. Returns CSV content and filename for download.
 */
export const getLineSetSummaryCsvForJob = async (
    jobId: number,
    userId: number,
    socket: EventEmitter
): Promise<{ csv: string; filename: string }> => {
    const job = await ExecutableJob.loadTask(jobId);
    if (job.attributes.user_id !== userId) {
        throw new TrError(
            'Not allowed to get line set summary for this job',
            'TRJOBC0006',
            'transit:networkDesign.errors.NotAllowedToGetLineWeights'
        );
    }
    if (job.attributes.name !== 'evolutionaryTransitNetworkDesign') {
        throw new TrError(
            'Job is not an evolutionary transit network design job',
            'TRJOBC0004',
            'transit:networkDesign.errors.InvalidJobType'
        );
    }
    const evolutionaryJob = job as EvolutionaryTransitNetworkDesignJob;
    const wrapper = new TransitNetworkDesignJobWrapper(evolutionaryJob, {
        progressEmitter: new EventEmitter(),
        isCancelled: () => false
    });
    const onProgress = (messageKey: string) => {
        socket.emit(TransitApi.TRANSIT_NETWORK_DESIGN_LINE_WEIGHTS_PROGRESS, { jobId, messageKey });
    };
    // Use server's event manager so loadFromServer is handled by backend (DB); passing client socket would send to browser and hang
    const serverEventManager = serviceLocator.socketEventManager;
    await wrapper.loadServerData(serverEventManager, onProgress);

    const parameters = evolutionaryJob.attributes.data.parameters;
    const simulatedAgencyIds = parameters?.transitNetworkDesignParameters?.simulatedAgencies ?? [];
    const agencies = simulatedAgencyIds
        .map((agencyId: string) => wrapper.agencyCollection.getById(agencyId))
        .filter((agency): agency is NonNullable<typeof agency> => agency !== null && agency !== undefined);
    const lines = agencies.flatMap((agency) => agency.getLines());

    const rows: string[] = [LINE_SET_SUMMARY_HEADER];
    for (const line of lines) {
        const totalNodeWeight = line.getTotalNodeWeight();
        if (totalNodeWeight === null) {
            continue;
        }
        const totalLengthMeters = line.getTotalLengthMeters();
        const cycleTimeSeconds = line.getCycleTimeSeconds();
        const weightXCycleTime =
            cycleTimeSeconds !== null && Number.isFinite(cycleTimeSeconds) ? totalNodeWeight * cycleTimeSeconds : '';
        rows.push(
            [
                escapeCsvField(line.getId()),
                escapeCsvField(String(line.get('shortname') ?? line.getId())),
                totalNodeWeight,
                totalLengthMeters !== null ? totalLengthMeters : '',
                cycleTimeSeconds !== null ? cycleTimeSeconds : '',
                weightXCycleTime
            ].join(',')
        );
    }
    const csv = rows.join('\n') + '\n';
    const jobDir = evolutionaryJob.getJobFileDirectory();
    if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
    }
    fs.writeFileSync(path.join(jobDir, LINE_SET_SUMMARY_CSV_FILENAME), csv, 'utf-8');
    return { csv, filename: LINE_SET_SUMMARY_CSV_FILENAME };
};
