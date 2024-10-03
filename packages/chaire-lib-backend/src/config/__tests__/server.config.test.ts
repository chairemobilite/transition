/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
process.env.PROJECT_CONFIG = `${__dirname}/../../../../../tests/config2_test.js`;
import config, { setProjectConfiguration } from '../server.config';
import path from 'path';

test('Expected default with env', () => {
    expect(config.userDiskQuota).toEqual('1gb');
    expect(config.maxFileUploadMB).toEqual(256);
    expect(config.projectShortname).toEqual('unitTest');
    expect(config.maxParallelCalculators).toEqual(1);
    expect(config.projectDirectory).toEqual(path.normalize(`${__dirname}/../../../../../tests/dir`));
    expect(config.routing.transit.engines.trRouting!.single).toEqual({ port: 4000, cacheAllScenarios: false });
    expect(config.routing.transit.engines.trRouting!.batch).toEqual({ port: 14000, cacheAllScenarios: false });
});

test('setProjectConfiguration', () => {
    setProjectConfiguration({
        projectShortname: 'newProject',
        mapDefaultCenter: { lon: -73, lat: 45 },
        routing: {
            transit: {
                defaultEngine: 'trRouting',
                engines: {
                    trRouting: { single: { port: 5000 } } as any 
                }
            }
        }
    });
    expect(config.mapDefaultCenter).toEqual({ lon: -73, lat: 45 });
    expect(config.separateAdminLoginPage).toEqual(false);
    expect(config.projectShortname).toEqual('newProject');
    // Make sure the deep merge works for object configs
    expect(config.routing.transit.engines.trRouting!.single).toEqual({ port: 5000, cacheAllScenarios: false });
    expect(config.routing.transit.engines.trRouting!.batch).toEqual({ port: 14000, cacheAllScenarios: false });
});
