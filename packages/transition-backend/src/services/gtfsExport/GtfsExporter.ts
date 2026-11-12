/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import zlib from 'zlib';
import { randomUUID } from 'crypto';
import { once, type EventEmitter } from 'events';
import { Transform } from 'stream';
import { finished, pipeline } from 'stream/promises';
import { Zip, type ZipInputFile } from 'fflate';

import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { exportAgency } from './AgencyExporter';
import { exportPath } from './PathExporter';
import { exportStop } from './StopExporter';
import { exportLine } from './LineExporter';
import { exportService } from './ServiceExporter';
import { exportSchedule } from './ScheduleExporter';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import type { GtfsExportParameters } from 'transition-common/lib/api/gtfs';
import servicesDbQueries from '../../models/db/transitServices.db.queries';
import agenciesDbQueries from '../../models/db/transitAgencies.db.queries';
import type { AgencyAttributes } from 'transition-common/lib/services/agency/Agency';

const preparationProgressName = 'GTFSExporterPreparation';

const quotesFct = function (value: unknown) {
    return typeof value === 'string' && value.includes(',');
};

/**
 * Zip the gtfs files
 *
 * @param {string} zipAbsoluteFilePath The absolute path to the gtfs file to produce
 * @param {string} zipDirectory The absolute directory containing the gtfs files to zip
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send progress to
 * @return {*} Relative file path of the zip file
 */
const writeZipFile = async (
    zipAbsoluteFilePath: string,
    zipDirectory: string,
    progressEmitter?: EventEmitter
): Promise<boolean> => {
    progressEmitter?.emit('progress', { name: 'GTFSExporterZipping', progress: 0.0 });
    try {
        const files = fileManager.directoryManager.getFilesAbsolute(zipDirectory);
        if (!files) {
            throw new TrError(`No files found for gtfs export in folder ${zipDirectory}`, 'GTFSEXP0010');
        }

        console.log('Start creating zip file ...');
        // Write to a temporary file, renamed once complete, so the zip file is never partial,
        // even while it is being written or when the export fails. Its name is unique, so
        // exports running at the same time do not write to the same temporary file.
        const temporaryZipFilePath = `${zipAbsoluteFilePath}.${randomUUID()}.tmp`;
        const output = fs.createWriteStream(temporaryZipFilePath);
        // First error from the zip or the output file. Listening to the output's
        // errors also keeps an unwritable path from crashing the process.
        let zipError: Error | null = null;
        output.on('error', (err) => {
            zipError ??= err;
        });
        const zipper = new Zip((err, data, final) => {
            if (err) {
                zipError ??= err;
                return;
            }
            output.write(data);
            if (final) {
                output.end();
            }
        });
        progressEmitter?.emit('progress', { name: 'GTFSExporterZipping', progress: 0.1 });
        try {
            // Files are compressed one after the other, so only one file's chunks are in memory at a time.
            // fflate writes the zip structure, but Node's zlib does the compression: its level 9 gives
            // smaller files than fflate's on GTFS data, and runs outside the main thread.
            for (const gtfsFile of files) {
                // compression 8 is deflate. crc and size are of the uncompressed data.
                const entry: ZipInputFile = { filename: gtfsFile, compression: 8, crc: 0, size: 0 };
                // add() sets entry.ondata, which takes this file's compressed data
                zipper.add(entry);
                // Each chunk of the file goes through these steps in order: read, crc and size, compression
                // with zlib, then sent to fflate. The pipeline waits on each step, so reading follows the
                // pace of the compression and of the output file.
                await pipeline(
                    fs.createReadStream(`${zipDirectory}/${gtfsFile}`),
                    // Updates the crc and size the zip needs, then passes the chunk unchanged to zlib
                    new Transform({
                        transform(chunk: Buffer, _encoding, callback) {
                            entry.crc = zlib.crc32(chunk, entry.crc);
                            entry.size += chunk.length;
                            callback(null, chunk);
                        }
                    }),
                    zlib.createDeflateRaw({ level: 9, memLevel: 9 }),
                    async (compressed: AsyncIterable<Buffer<ArrayBuffer>>) => {
                        for await (const data of compressed) {
                            entry.ondata?.(null, data, false);
                            if (zipError) {
                                throw zipError;
                            }
                            if (output.writableNeedDrain) {
                                await once(output, 'drain');
                            }
                        }
                    }
                );
                // Tells fflate this file is complete: it then writes the file's crc and sizes, known
                // only now, and goes on with the next file.
                // The arguments are (error, data, isLastChunk): an empty chunk marked as the last one,
                // because the last compressed chunk is only known once zlib has finished.
                entry.ondata?.(null, new Uint8Array(0), true);
            }
            zipper.end();
            await finished(output);
            await fs.promises.rename(temporaryZipFilePath, zipAbsoluteFilePath);
        } catch (error) {
            zipper.terminate();
            output.destroy();
            // Wait for the file to be closed, then remove it, without hiding the original error
            await finished(output).catch(() => undefined);
            await fs.promises.rm(temporaryZipFilePath, { force: true }).catch(() => undefined);
            throw error;
        }
        console.log('Creating zip file complete.');
        return true;
    } finally {
        // Always complete the progress, even on error, so the notification does not stay forever
        progressEmitter?.emit('progress', { name: 'GTFSExporterZipping', progress: 1.0 });
    }
};

type DataFilterOptions = Pick<
    GtfsExportParameters,
    'selectedAgencies' | 'selectedServices' | 'includeTransitionCustomFields'
>;

// Get the services to export based on the selected agencies.
const getServicesToExportForAgencies = async (
    filteredAgencies: AgencyAttributes[],
    lineIdsFromAgencies: string[]
): Promise<{
    agencyIds: string[];
    serviceIds: string[];
    lineIds: string[];
}> => {
    // Get all services
    const services = await servicesDbQueries.collection();

    // Export only the services that have at least one line in the selected agencies, if any.
    const serviceIdsToExport = services
        .filter((service) => (service.scheduled_lines ?? []).some((lineId) => lineIdsFromAgencies.includes(lineId)))
        .map((service) => service.id!);
    return {
        agencyIds: filteredAgencies.map((agency) => agency.id),
        serviceIds: serviceIdsToExport,
        lineIds: lineIdsFromAgencies
    };
};

// Get the services, agencies and lines to export based on the selected services.
const getServicesToExportFromSelection = async (
    filteredAgencies: AgencyAttributes[],
    lineIdsFromAgencies: string[],
    selectedServices: string[]
): Promise<{
    agencyIds: string[];
    serviceIds: string[];
    lineIds: string[];
}> => {
    // Get only the selected services, with their scheduled lines,
    const services = await servicesDbQueries.collection({ serviceIds: selectedServices });

    // Export only the services that have at least one line in the selected agencies, if any.
    const servicesToExport = services.filter((service) =>
        (service.scheduled_lines ?? []).some((lineId) => lineIdsFromAgencies.includes(lineId))
    );

    // Further filter the agencies and lines to those used by the selected
    // services.
    const servicedLineIds = Array.from(
        new Set(servicesToExport.map((service) => service.scheduled_lines ?? []).flat())
    );

    // Get the lines that are in both agencies and services selection. If no agency was selected, all lines should be in the array
    const lineIdsToExport = servicedLineIds.filter((lineId) => lineIdsFromAgencies.includes(lineId));

    // Further reduce the agencies to export to include only those for which there is service
    const agencyIdsToExport = filteredAgencies
        .filter((agency) => (agency.line_ids ?? []).some((lineId) => lineIdsToExport.includes(lineId)))
        .map((agency) => agency.id!);

    return {
        agencyIds: agencyIdsToExport,
        serviceIds: servicesToExport.map((service) => service.id!),
        lineIds: lineIdsToExport
    };
};

// Filter agencies and services to export based on the selected options.
const getDataToExport = async (
    dataFilterOptions: DataFilterOptions
): Promise<{
    agencyIds: string[];
    serviceIds: string[];
    lineIds: string[];
}> => {
    // Load agency collection and filter the selected agencies if a list if set
    // FIXME When we have queries that support filters, use that here
    const agencies = await agenciesDbQueries.collection();
    const filteredAgencies =
        dataFilterOptions.selectedAgencies.length > 0
            ? agencies.filter((agency) => dataFilterOptions.selectedAgencies.includes(agency.id))
            : agencies;

    // Get the lines of the selected agencies, a line only belongs to one agency, so no need to check for duplicates
    const lineIdsFromAgencies = Array.from(new Set(filteredAgencies.flatMap((agency) => agency.line_ids ?? [])));

    // If there was no specific service selected, return the agencies and services filtered only by the selected agencies.
    if (dataFilterOptions.selectedServices.length === 0) {
        return await getServicesToExportForAgencies(filteredAgencies, lineIdsFromAgencies);
    }
    return await getServicesToExportFromSelection(
        filteredAgencies,
        lineIdsFromAgencies,
        dataFilterOptions.selectedServices
    );
};

/**
 * Exports the selected elements to GTFS, including all agencies, routes,
 * services and schedules
 *
 * TODO Save the file directly to the right filename, then make sure the client
 * requests the proper file. Also make this concurrent-safe. Now 2 requests to
 * export by the same user will result in the same file being overwritten. The
 * last one to finish will be the one that can be downloaded.
 *
 * @param {DataFilterOptions} dataFilterOptions The GTFS data filter options,
 * should include either or both selected agencies or services.
 * @param {string} exportAbsoluteDirectory Directory where to put the files to
 * export
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send
 * progress to
 * @return {*} Return the relative file path where the zip file was generated
 */
export const exportGtfs = async (
    dataFilterOptions: DataFilterOptions,
    exportAbsoluteDirectory: string,
    progressEmitter?: EventEmitter
): Promise<string> => {
    if (dataFilterOptions.selectedAgencies.length === 0 && dataFilterOptions.selectedServices.length === 0) {
        throw new TrError('No data specified for GTFS export', 'GTFSEXP0001');
    }
    progressEmitter?.emit('progress', { name: preparationProgressName, progress: 0.0 });

    const gtfsFileDirectory = `${exportAbsoluteDirectory}/gtfs`;
    const includeCustomFields = dataFilterOptions.includeTransitionCustomFields ?? false;
    try {
        const nbExportSteps = 7;
        let currentStepCompleted = 0;
        fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(gtfsFileDirectory);

        const { agencyIds, serviceIds, lineIds } = await getDataToExport(dataFilterOptions);
        // Make sure there is data to export, otherwise throw an error
        if (agencyIds.length === 0 || serviceIds.length === 0) {
            throw new TrError('No data to export in the GTFS', 'GTFSEXP0002');
        }

        // Export agencies
        const agencyExportResponse = await exportAgency(agencyIds, {
            directoryPath: gtfsFileDirectory,
            quotesFct,
            includeTransitionFields: includeCustomFields
        });
        if (agencyExportResponse.status !== 'success') {
            throw agencyExportResponse.error;
        }
        currentStepCompleted++;
        progressEmitter?.emit('progress', {
            name: preparationProgressName,
            progress: (currentStepCompleted / nbExportSteps).toFixed(2)
        });

        // Export the lines from the agencies
        const lineExportResponse = await exportLine(lineIds, {
            directoryPath: gtfsFileDirectory,
            quotesFct,
            agencyToGtfsId: agencyExportResponse.agencyToGtfsId,
            includeTransitionFields: includeCustomFields
        });
        if (lineExportResponse.status !== 'success') {
            throw lineExportResponse.error;
        }
        currentStepCompleted++;
        progressEmitter?.emit('progress', {
            name: preparationProgressName,
            progress: (currentStepCompleted / nbExportSteps).toFixed(2)
        });

        // Export the services used by the agencies' lines, or only those selected if any
        const serviceExportResponse = await exportService(serviceIds, {
            directoryPath: gtfsFileDirectory,
            quotesFct,
            includeTransitionFields: includeCustomFields
        });
        if (serviceExportResponse.status !== 'success') {
            throw serviceExportResponse.error;
        }
        currentStepCompleted++;
        progressEmitter?.emit('progress', {
            name: preparationProgressName,
            progress: (currentStepCompleted / nbExportSteps).toFixed(2)
        });
        const serviceIdToGtfsId = serviceExportResponse.serviceToGtfsId;

        // Export the schedules (trips and stop_times)
        const scheduleExportResponse = await exportSchedule(lineIds, {
            directoryPath: gtfsFileDirectory,
            quotesFct,
            serviceToGtfsId: serviceIdToGtfsId,
            includeTransitionFields: includeCustomFields
        });
        if (scheduleExportResponse.status !== 'success') {
            throw scheduleExportResponse.error;
        }
        currentStepCompleted++;
        progressEmitter?.emit('progress', {
            name: preparationProgressName,
            progress: (currentStepCompleted / nbExportSteps).toFixed(2)
        });

        // Export the nodes used by the paths whose schedules were exported
        const nodeExportResponse = await exportStop(scheduleExportResponse.nodeIds, {
            directoryPath: gtfsFileDirectory,
            quotesFct,
            includeTransitionFields: includeCustomFields
        });
        if (nodeExportResponse.status !== 'success') {
            throw nodeExportResponse.error;
        }
        currentStepCompleted++;
        progressEmitter?.emit('progress', {
            name: preparationProgressName,
            progress: (currentStepCompleted / nbExportSteps).toFixed(2)
        });

        // Export the shapes used by schedules
        const pathExportResponse = await exportPath(scheduleExportResponse.pathIds, {
            directoryPath: gtfsFileDirectory,
            quotesFct,
            includeTransitionFields: includeCustomFields
        });
        if (pathExportResponse.status !== 'success') {
            throw pathExportResponse.error;
        }
        currentStepCompleted++;
        progressEmitter?.emit('progress', {
            name: preparationProgressName,
            progress: (currentStepCompleted / nbExportSteps).toFixed(2)
        });

        const zipFileName = 'gtfs.zip';
        await writeZipFile(`${exportAbsoluteDirectory}/${zipFileName}`, gtfsFileDirectory, progressEmitter);
        return zipFileName;
    } finally {
        progressEmitter?.emit('progress', { name: preparationProgressName, progress: 1.0 });
    }
};
