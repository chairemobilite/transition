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
import { GtfsExportParameters } from 'transition-common/lib/api/gtfs';
import servicesDbQueries from '../../models/db/transitServices.db.queries';
import agenciesDbQueries from '../../models/db/transitAgencies.db.queries';
import { AgencyAttributes } from 'transition-common/lib/services/agency/Agency';

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
                streamFiles: true,
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 9
                }
            })
            .pipe(fs.createWriteStream(zipAbsoluteFilePath))
            .on('finish', () => {
                console.log('Creating zip file complete.');
                progressEmitter?.emit('progress', { name: 'GTFSExporterZipping', progress: 1.0 });
                resolve(true);
            });
    });
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
