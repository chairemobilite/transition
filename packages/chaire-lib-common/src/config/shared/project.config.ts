/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
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
            confirmEmail?: boolean;
            confirmEmailStrategy?: 'confirmByAdmin' | 'confirmByUser';
        };
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
    maxParallelCalculators: number;
} & AdditionalConfig;

// Initialize default configuration
const projectConfig: ProjectConfiguration<any> = {
    mapDefaultCenter: { lon: -73.6131, lat: 45.5041 },
    separateAdminLoginPage: false,
    projectShortname: process.env.PROJECT_SHORTNAME,
    userDiskQuota: '1gb',
    maxFileUploadMB: 256,
    maxParallelCalculators: 1
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
    Object.keys(config).forEach((configKey) => (projectConfig[configKey] = config[configKey]));

export default projectConfig;
