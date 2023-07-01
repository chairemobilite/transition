/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import config, { ProjectConfiguration } from 'chaire-lib-common/lib/config/shared/project.config';

export type TransitionConfig = {
    // TODO Add more fields in the next steps of configuration update. For now, we just need one example field
    socketUploadChunkSize: number;
};

const projectConfig = config as ProjectConfiguration<TransitionConfig>;

export { setProjectConfiguration } from 'chaire-lib-common/lib/config/shared/project.config';

export default projectConfig;
