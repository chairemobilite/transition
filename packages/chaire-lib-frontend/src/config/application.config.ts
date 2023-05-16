/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TFunction } from 'i18next';
import { UserPages } from 'chaire-lib-common/lib/services/user/userType';
import { MouseEventHandler } from 'react';

export type UserMenuItem = {
    getText: (t: TFunction) => string;
    action: MouseEventHandler;
    /**
     * Extra action to run after the action has been run. This allows to trigger
     * some events on the page. 'refreshLang' will cause a refresh of the
     * translation strings on the page.
     */
    postExec?: 'refreshLang';
    confirmModal?: {
        title: (t: TFunction) => string;
        label: (t: TFunction) => string;
    };
};

export type ApplicationConfiguration<AdditionalConfig> = {
    /**
     * Main page to redirect to by default when logging in
     */
    homePage: string;
    /**
     * Pages available to the user, once logged in
     */
    pages: UserPages[];
    /**
     * Items that will be added to the menu, when clicking on the logged in user
     * name
     */
    userMenuItems: UserMenuItem[];
} & AdditionalConfig;

const appConfiguration: ApplicationConfiguration<any> = {
    homePage: '/',
    pages: [],
    userMenuItems: []
};

export const setApplicationConfiguration = <AdditionalConfig>(
    config: Partial<ApplicationConfiguration<AdditionalConfig>>
) => Object.keys(config).forEach((configKey) => (appConfiguration[configKey] = config[configKey]));

export default appConfiguration;
