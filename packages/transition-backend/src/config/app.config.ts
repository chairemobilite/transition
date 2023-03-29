/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Make sure environment has been read first
import 'chaire-lib-backend/lib/config/dotenv.config';
import {
    initializeConfig,
    serverConfig as serverConfiguration,
    ServerConfiguration
} from 'chaire-lib-backend/lib/config/config';
import { TransitionConfig } from 'transition-common/lib/config/project.config';
export { default as projectConfig } from 'transition-common/lib/config/project.config';

type TransitionServerConfig = {
    // TODO Add more fields in the next steps of configuration update. For now, we just need one example field
    startupRestartJob: boolean;
};

const defaultServerConfig = {
    startupRestartJob: true
};

const defaultProjectConfig = {
    socketUploadChunkSize: 10240
};

const parseServerConfig = (configFromFile: { [key: string]: any }): TransitionServerConfig => ({
    startupRestartJob:
        configFromFile.startupRestartJob !== undefined
            ? configFromFile.startupRestartJob
            : defaultServerConfig.startupRestartJob
});

const parseProjectConfig = (configFromFile: { [key: string]: any }): TransitionConfig => ({
    socketUploadChunkSize:
        configFromFile.socketUploadChunkSize !== undefined
            ? configFromFile.socketUploadChunkSize
            : defaultProjectConfig.socketUploadChunkSize
});

initializeConfig(parseServerConfig, parseProjectConfig);

export const serverConfig = serverConfiguration as ServerConfiguration<TransitionServerConfig>;
