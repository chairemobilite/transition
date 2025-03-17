/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _merge from 'lodash/merge';

type SectionType = {
    localizedTitle: string;
    icon: string;
    showMap?: boolean;
    showFullSizePanel?: boolean;
    enabled?: boolean;
};

// TODO Some project config option depend on the application, so should not be
// typed in chaire-lib. Each app (transition , evolution, etc) should add types
// to the config and should have a project.config file which imports this one
// for common options.
export type ProjectConfiguration<AdditionalConfig> = {
    projectShortname: string;
    mapDefaultCenter: { lon: number; lat: number };
    auth: {
        passwordless?: {
            directFirstLogin: boolean;
        };
        anonymous?: boolean;
        localLogin?: {
            /** This will send an email to confirm the user's email address.
             * Email send needs to be configured. By default, users can register
             * and directly login. */
            confirmEmail?: boolean;
            /**
             * If `confirmEmail` is true, this will determine who needs to
             * confirm the account, the user himself, to validate his email
             * address, or an admin, to validate the person's identity. Defaults
             * to `confirmByUser`
             */
            confirmEmailStrategy?: 'confirmByAdmin' | 'confirmByUser';
            /**
             * Whether to allow users to reset their password. If false, the
             * forgot password page will not be available. By default the page
             * is not present
             */
            forgotPasswordPage?: boolean;
            /**
             * Whether to require only an email to login, no username. Defaults
             * to false
             */
            registerWithEmailOnly?: boolean;
            /**
             * Whether users can create an account. If false, the register page
             * will not be available. Defaults to true
             */
            allowRegistration?: boolean;
        };
        /**
         * Configures authentication by direct token access. The user is
         * identified by the value of a token added as a query parameter to the
         * login page, in the `access_token` field (ex.
         * http://localhost:8080?access_token=token)
         *
         * Value can be `false` to deactivate this login method, `true` to
         * activate with any token in parameter, or an object with the token
         * format.
         */
        directToken?:
            | boolean
            | {
                  /**
                   * If specified, the token will have to match this regular
                   * expression. See the official javascript documentation for the
                   * regular expression format
                   * (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions)
                   *
                   * example:
                   * - /^[\d]{10}$/ for 10-number values
                   * - /^[0-9A-F]{4}-[0-9A-F]{4}$/i for 2 dash separated sets of 4
                   *   hexadecimal characters
                   */
                  tokenFormat: RegExp;
              };
        google?: boolean;
        facebook?: boolean;
    };
    separateAdminLoginPage: boolean;
    // @deprecated
    confirmEmail?: boolean;
    // @deprecated
    confirmEmailStrategy?: 'confirmByAdmin' | 'confirmByUser';
    languages: string[];
    defaultLocale: string;

    // TODO The following configuration options should be only available on the server side, it's leaking information
    /**
     * The default disk usage quota for a user. The string is a number suffixed
     * with the units, kb, mb or gb
     */
    userDiskQuota: string;
    /**
     * Maximum file upload size, in megabytes. Defaults to 256MB
     */
    maxFileUploadMB: number;
    /**
     * Absolute directory where project data will be stored (import files, osrm data, user data, caches, etc)
     */
    projectDirectory: string;

    /**
     * Configuration for the sections in the project. Used for apps that use the
     * contributions system, with "dashboard" components
     */
    sections: {
        [sectionName: string]: SectionType;
    };
} & AdditionalConfig;

// Initialize default configuration
const projectConfig: ProjectConfiguration<any> = {
    mapDefaultCenter: { lon: -73.6131, lat: 45.5041 },
    separateAdminLoginPage: false,
    projectShortname: 'default',
    userDiskQuota: '1gb',
    maxFileUploadMB: 256,
    sections: {}
};

/**
 * Set the project configuration options. Backend and frontend will get this
 * data in a different way and will typically call this function to set the
 * configurations.
 *
 * @param config The configuration options to set
 * @returns
 */
export const setProjectConfiguration = <AdditionalConfig>(config: Partial<ProjectConfiguration<AdditionalConfig>>) =>
    Object.keys(config).forEach((configKey) =>
        typeof projectConfig[configKey] === 'object'
            ? _merge(projectConfig[configKey], config[configKey])
            : (projectConfig[configKey] = config[configKey])
    );

export default projectConfig;
