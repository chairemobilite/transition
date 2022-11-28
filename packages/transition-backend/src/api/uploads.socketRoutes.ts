/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import JSZip from 'jszip';
import SocketIO from 'socket.io';

import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import uploadSocketRoutes from 'chaire-lib-backend/lib/api/uploads.socketRoutes';
import serverConfig from 'chaire-lib-backend/lib/config/server.config';
import GtfsImportPreparation from '../services/gtfsImport/GtfsImportPreparation';
import agenciesImporter from '../services/importers/AgenciesImporter';
import nodesImporter from '../services/importers/NodesImporter';
import scenariosImporter from '../services/importers/ScenariosImporter';
import servicesImporter from '../services/importers/ServicesImporter';
import linesImporter from '../services/importers/LinesImporter';
import pathsImporter from '../services/importers/PathsImporter';
import Users from 'chaire-lib-backend/lib/services/users/users';

const gtfsImportFunction = async (socket: SocketIO.Socket, absoluteUserDir: string, filePath: string) => {
    const gtfsFilesDirectoryPath = `${absoluteUserDir}/gtfs/gtfs/`;
    // gtfs zip file
    //const gtfsDirectoryPath = fileUploader.options.uploadDirectory;
    directoryManager.createDirectoryIfNotExistsAbsolute(gtfsFilesDirectoryPath);
    directoryManager.emptyDirectoryAbsolute(gtfsFilesDirectoryPath);

    // TODO: Consider moving to an `extract` method if this is needed anywhere else
    try {
        const zipData = fs.readFileSync(filePath);
        const zip = new JSZip();
        const zipFileContent = await zip.loadAsync(zipData);
        const filePromises = Object.keys(zipFileContent.files).map(async (filename) => {
            const fileInfo = zip.file(filename);
            if (fileInfo === null) {
                return;
            }
            const content = await fileInfo.async('nodebuffer');
            const dest = gtfsFilesDirectoryPath + filename;
            fs.writeFileSync(dest, content);
        });
        Promise.all(filePromises);
        console.log('GTFS zip file upload Complete.');
        socket.emit('gtfsImporter.gtfsFileUnzipped');

        const importData = await GtfsImportPreparation.prepare(gtfsFilesDirectoryPath);
        socket.emit('gtfsImporter.gtfsFilePrepared', importData);
        console.log('GTFS zip file prepared');
    } catch (err) {
        console.error('Error importing gtfs file', err);
        socket.emit('gtfsImporter.gtfsUploadError', 'error importing gtfs file ' + String(err));
    }
};

const importerByObjectName = {
    nodes: { type: 'importerObject' as const, object: nodesImporter },
    agencies: { type: 'importerObject' as const, object: agenciesImporter },
    lines: { type: 'importerObject' as const, object: linesImporter },
    paths: { type: 'importerObject' as const, object: pathsImporter },
    scenarios: { type: 'importerObject' as const, object: scenariosImporter },
    services: { type: 'importerObject' as const, object: servicesImporter },
    gtfs: { type: 'function' as const, fct: gtfsImportFunction }
};

export default function(socket: SocketIO.Socket, userId: number) {
    // FIXME Can't use remaining as files may be deleted and this is set up once per user
    const quota = Users.getUserQuota(userId);
    const absoluteUserDir = `${directoryManager.userDataDirectory}/${userId}`;
    uploadSocketRoutes(socket, absoluteUserDir, importerByObjectName, {
        uploadDirs: {
            gtfs: `${absoluteUserDir}/gtfs`,
            imports: `${absoluteUserDir}/imports`,
            uploads: `${absoluteUserDir}/uploads`
        },
        maxFileSizeMB: Math.min(quota === -1 ? Number.MAX_VALUE : quota / 1024 / 1024, serverConfig.maxFileUploadMB)
    });
}
