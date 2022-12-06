/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import JSZip from 'jszip';
import { EventEmitter } from 'events';

import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { exportAgency } from './AgencyExporter';
import { exportPath } from './PathExporter';
import { exportStop } from './StopExporter';
import { exportLine } from './LineExporter';
import { exportService } from './ServiceExporter';
import { exportSchedule } from './ScheduleExporter';
import TrError from 'chaire-lib-common/lib/utils/TrError';

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
    return new Promise((resolve, _reject) => {
        progressEmitter?.emit('progress', { name: 'GTFSExporterZipping', progress: 0.0 });

        const files = fileManager.directoryManager.getFilesAbsolute(zipDirectory);
        if (!files) {
            throw new TrError(`No files found for gtfs export in folder ${zipDirectory}`, 'GTFSEXP0010');
        }

        console.log('Start creating zip file ...');
        const zipper = new JSZip();

        files.forEach((gtfsFile) => zipper.file(gtfsFile, fs.createReadStream(`${zipDirectory}/${gtfsFile}`)));
        progressEmitter?.emit('progress', { name: 'GTFSExporterZipping', progress: 0.1 });
        zipper
            .generateNodeStream({
                type: 'nodebuffer',
                streamFiles: true
            })
            .pipe(fs.createWriteStream(zipAbsoluteFilePath))
            .on('finish', () => {
                console.log('Creating zip file complete.');
                progressEmitter?.emit('progress', { name: 'GTFSExporterZipping', progress: 1.0 });
                resolve(true);
            });
    });
};

/**
 * Exports the selected agencies to GTFS, including all routes, services and
 * schedules
 *
 * TODO Save the file directly to the right filename, then make sure the client
 * requests the proper file. Also make this concurrent-safe. Now 2 requests to
 * gtfs from different users will result in the same file being written
 *
 * @param {string[]} selectedAgencyIds An array of agencies to export
 * @param {string[]} exportAbsoluteDirectory Directory where to put the files to
 * export
 * @param {EventEmitter} [progressEmitter] Optional event emitter to send
 * progress to
 * @return {*} Return the relative file path where the zip file was generated
 */
export const exportGtfs = async (
    selectedAgencyIds: string[],
    exportAbsoluteDirectory: string,
    progressEmitter?: EventEmitter
): Promise<string> => {
    progressEmitter?.emit('progress', { name: preparationProgressName, progress: 0.0 });

    const gtfsFileDirectory = `${exportAbsoluteDirectory}/gtfs`;
    const includeCustomFields = true;
    try {
        const nbExportSteps = 7;
        let currentStepCompleted = 0;
        fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(gtfsFileDirectory);

        // Export agencies
        const agencyExportResponse = await exportAgency(selectedAgencyIds, {
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
        const lineIds = agencyExportResponse.lineIds;
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

        // Export the services used by the agencies' lines
        const serviceIdsUsed = lineExportResponse.serviceIds;
        const serviceExportResponse = await exportService(serviceIdsUsed, {
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
