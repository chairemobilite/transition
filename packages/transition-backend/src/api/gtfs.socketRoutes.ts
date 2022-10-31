/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { isSocketIo } from './socketUtils';
import { GtfsImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { GtfsConstants, GtfsExportParameters } from 'transition-common/lib/api/gtfs';
import GtfsImporter from '../services/gtfsImport/GtfsImporter';
import { exportGtfs } from '../services/gtfsExport/GtfsExporter';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';

// TODO Use a typeguard to check socket.io type to emit broadcasts
export default function(socket: EventEmitter, userId: number) {
    const absoluteUserDir = `${directoryManager.userDataDirectory}/${userId}`;
    const gtfsImportDirectory = `${absoluteUserDir}/gtfs/gtfs`;
    const exportAbsoluteDirectory = `${absoluteUserDir}/exports`;

    socket.on(GtfsConstants.GTFS_IMPORT_DATA, async (parameters: GtfsImportData) => {
        try {
            const result = await GtfsImporter.importGtfsData(gtfsImportDirectory, parameters, socket);
            const { nodesDirty, ...rest } = result;
            if (nodesDirty) {
                socket.emit('transferableNodes.dirty');
            }
            socket.emit(GtfsConstants.GTFS_DATA_IMPORTED, { ...rest });
            if (isSocketIo(socket)) {
                socket.broadcast.emit('data.updated');
            }
            socket.emit('cache.dirty');
        } catch (error) {
            console.error('Error importing GTFS:', error);
            socket.emit(GtfsConstants.GTFS_DATA_IMPORTED, { status: 'failed', errors: [error] });
            if (isSocketIo(socket)) {
                socket.broadcast.emit('data.updated');
            }
            socket.emit('cache.dirty');
        }
    });

    socket.on(GtfsConstants.GTFS_EXPORT_PREPARE, async (parameters: GtfsExportParameters) => {
        try {
            const zipFilePath = await exportGtfs(parameters.selectedAgencies, exportAbsoluteDirectory, socket);
            console.log('GTFS export prepared');
            socket.emit(GtfsConstants.GTFS_EXPORT_READY, {
                status: 'success',
                gtfsExporterId: parameters.gtfsExporterId,
                zipFilePath: `exports/${zipFilePath}`
            });
        } catch (error) {
            console.error(`Error exporting GTFS for agencies ${parameters.selectedAgencies}: ${error}`);
            socket.emit(GtfsConstants.GTFS_EXPORT_READY, {
                status: 'failed',
                gtfsExporterId: parameters.gtfsExporterId,
                errors: [GtfsMessages.GtfsExportError]
            });
        }
    });
}
