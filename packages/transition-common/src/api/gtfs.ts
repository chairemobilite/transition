/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Unused vars, but linked to in the documentation
import { GtfsImportData } from '../services/gtfs/GtfsImportTypes'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

export interface GtfsExportParameters {
    gtfsExporterId: string;
    /**
     * IDs of the agencies to export
     *
     * @type {string[]}
     * @memberof GtfsExportParameters
     */
    selectedAgencies: string[];
    filename: string;
}

export type GtfsImportStatus =
    | { status: 'success'; warnings: ErrorMessage[]; errors: ErrorMessage[] }
    | { status: 'failed'; errors: ErrorMessage[] };

/**
 * Upon success, the gtfsExporterId shoud match the gtfsExporterId of the export
 * parameter. The zipFilePath is the actual file to download from server.
 * */

export type GtfsExportStatus =
    | { status: 'success'; gtfsExporterId: string; zipFilePath: string }
    | { status: 'failed'; gtfsExporterId: string; errors: ErrorMessage[] };

export class GtfsConstants {
    /**
     * Socket route name to import data from a GTFS file previously uploaded to
     * the server. This route expects a parameter of type {@link GtfsImportData}
     *
     * @static
     * @memberof GtfsConstants
     */
    static readonly GTFS_IMPORT_DATA = 'gtfsImporter.importData';
    /**
     * Socket route name to notify the client that GTFS data has finished
     * importing. This route expects a parameter of type
     * {@link GtfsImportStatus}
     *
     * @static
     * @memberof GtfsConstants
     */
    static readonly GTFS_DATA_IMPORTED = 'gtfsImporter.dataImported';

    /**
     * Socket route name to request the preparation of a GTFS archive. The route
     * expects a parameter of type {@link GtfsExportParameters}
     *
     * @static
     * @memberof GtfsConstants
     */
    static readonly GTFS_EXPORT_PREPARE = 'gtfsExporter.prepare';
    /**
     * Socket route notifying the client that GTFS data has been prepared and is
     * ready to download or there was an error. This route expects a parameter
     * of type {@link GtfsExportStatus}
     *
     * @static
     * @memberof GtfsConstants
     */
    static readonly GTFS_EXPORT_READY = 'gtfsExporter.ready';
}
