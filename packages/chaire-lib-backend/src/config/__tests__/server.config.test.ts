/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
process.env.PROJECT_CONFIG = `${__dirname}/../../../../../tests/config2_test.js`;
import os from 'os';
import config, { setProjectConfiguration } from '../server.config';
import path from 'path';

const availableCPUs = os.cpus();
jest.mock('os', () => ({
    // Return 4 CPUs
    cpus: jest.fn().mockReturnValue([
        { model: 'Intel(R) Core(TM) i7-7700HQ CPU @ 2.80GHz', speed: 2800, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
        { model: 'Intel(R) Core(TM) i7-7700HQ CPU @ 2.80GHz', speed: 2800, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
        { model: 'Intel(R) Core(TM) i7-7700HQ CPU @ 2.80GHz', speed: 2800, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
        { model: 'Intel(R) Core(TM) i7-7700HQ CPU @ 2.80GHz', speed: 2800, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }
    ]),
}));

test('Expected default with env', () => {
    expect(config.userDiskQuota).toEqual('1gb');
    expect(config.maxFileUploadMB).toEqual(256);
    expect(config.projectShortname).toEqual('unitTest');
    expect(config.maxParallelCalculators).toEqual(availableCPUs.length);
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
        },
        maxParallelCalculators: 3
    });
    expect(config.mapDefaultCenter).toEqual({ lon: -73, lat: 45 });
    expect(config.separateAdminLoginPage).toEqual(false);
    expect(config.maxParallelCalculators).toEqual(3);
    expect(config.projectShortname).toEqual('newProject');
    // Make sure the deep merge works for object configs
    expect(config.routing.transit.engines.trRouting!.single).toEqual({ port: 5000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 5120 } });
    expect(config.routing.transit.engines.trRouting!.batch).toEqual({ port: 14000, cacheAllScenarios: false, debug: false, logs: { nbFiles: 3, maxFileSizeKB: 10000 } });
    expect(config.routing.driving!.engines.osrmRouting).toEqual({ port: 1234, host: null, autoStart: true, enabled: false });
});

describe('setProjectConfiguration, wrong values for max parallel calculators', () => {

    const warnSpy = jest.spyOn(console, 'warn');
    beforeEach(() => {
        warnSpy.mockClear();
    });

    test('negative value', () => {
        setProjectConfiguration({
            maxParallelCalculators: -3
        });
        expect(config.maxParallelCalculators).toEqual(availableCPUs.length);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toBe(`maxParallelCalculators (-3) must be a positive number. Using the number of CPUs instead: ${availableCPUs.length}`);
    });

    test('more than CPU count', () => {
        const parallelCalculators = 16;
        setProjectConfiguration({
            maxParallelCalculators: parallelCalculators
        });
        expect(config.maxParallelCalculators).toEqual(parallelCalculators);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toBe(`maxParallelCalculators (${parallelCalculators}) should not exceed the number of CPUs: ${availableCPUs.length}. This may cause performance issues.`);
    });
    
});
