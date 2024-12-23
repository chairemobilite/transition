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
    expect(config.routing.transit.engines.trRouting!.single).toEqual({ port: 4000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 5120 } });
    expect(config.routing.transit.engines.trRouting!.batch).toEqual({ port: 14000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 5120 }});
    expect(config.routing.driving!.engines.osrmRouting).toEqual({ port: 7000, host: null, autoStart: true, enabled: true });
});

test('setProjectConfiguration', () => {
    setProjectConfiguration({
        projectShortname: 'newProject',
        mapDefaultCenter: { lon: -73, lat: 45 },
        routing: {
            transit: {
                defaultEngine: 'trRouting',
                engines: {
                    trRouting: { single: { port: 5000 }, batch: { logs: { maxFileSizeKB: 10000 } } } as any 
                }
            },
            driving: {
                defaultEngine: 'osrmRouting',
                engines: {
                    osrmRouting: { port: 1234, enabled: false } as any
                }
            }
        }
    });
    expect(config.mapDefaultCenter).toEqual({ lon: -73, lat: 45 });
    expect(config.separateAdminLoginPage).toEqual(false);
    expect(config.projectShortname).toEqual('newProject');
    // Make sure the deep merge works for object configs
    expect(config.routing.transit.engines.trRouting!.single).toEqual({ port: 5000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 5120 } });
    expect(config.routing.transit.engines.trRouting!.batch).toEqual({ port: 14000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 10000 } });
    expect(config.routing.driving!.engines.osrmRouting).toEqual({ port: 1234, host: null, autoStart: true, enabled: false });
});
