/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { UserPages } from 'chaire-lib-common/lib/services/user/userType';

export type ApplicationConfiguration<AdditionalConfig> = {
    /**
     * Main page to redirect to by default when logging in
     */
    homePage: string;
    /**
     * Pages available to the user, once logged in
     */
    pages: UserPages[];
} & AdditionalConfig;

const appConfiguration: ApplicationConfiguration<any> = {
    homePage: '/',
    pages: []
};

export const setApplicationConfiguration = <AdditionalConfig>(
    config: Partial<ApplicationConfiguration<AdditionalConfig>>
) => Object.keys(config).forEach((configKey) => (appConfiguration[configKey] = config[configKey]));

export default appConfiguration;
