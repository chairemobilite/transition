/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import projectConfig, { setProjectConfiguration } from '../project.config';

test('Expected default', () => {
    expect(projectConfig.userDiskQuota).toEqual('1gb');
    expect(projectConfig.maxFileUploadMB).toEqual(256);
    expect(projectConfig.mapDefaultCenter).toEqual({ lon: -73.6131, lat: 45.5041 });
    expect(projectConfig.separateAdminLoginPage).toEqual(false);
    expect(projectConfig.projectShortname).toEqual('default');
    
});

test('setProjectConfiguration', () => {
    setProjectConfiguration({
        projectShortname: 'newProject',
        mapDefaultCenter: { lon: -73, lat: 45 },
    });
    expect(projectConfig.mapDefaultCenter).toEqual({ lon: -73, lat: 45 });
    expect(projectConfig.separateAdminLoginPage).toEqual(false);
    expect(projectConfig.projectShortname).toEqual('newProject');
});
