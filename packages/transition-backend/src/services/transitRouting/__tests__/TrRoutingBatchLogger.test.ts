/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { performance } from 'perf_hooks';

import {
    InteractiveBatchRoutingLogProgress,
    NonInteractiveBatchRoutingLogProgress
} from '../TrRoutingBatchLogger';

describe('InteractiveBatchRoutingLogProgress', () => {
    let stdoutWriteSpy: jest.SpyInstance;

    beforeEach(() => {
        stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        stdoutWriteSpy.mockRestore();
        jest.restoreAllMocks();
    });

    test('afterOdTrip writes a progress line when percentage increases', () => {
        const nowSpy = jest.spyOn(performance, 'now');
        nowSpy.mockReturnValue(0);
        const benchmarkStart = 0;
        const logger = new InteractiveBatchRoutingLogProgress(0, 100, benchmarkStart);
        nowSpy.mockReturnValue(1000);

        logger.afterOdTrip(49, 50);

        expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
        const written = String(stdoutWriteSpy.mock.calls[0][0]);
        expect(written).toContain('\r');
        expect(written).toContain('50%');
        expect(written).toContain('50/100');
    });

    test('afterOdTrip does not write when floor percentage did not increase', () => {
        const nowSpy = jest.spyOn(performance, 'now');
        nowSpy.mockReturnValue(1000);
        const logger = new InteractiveBatchRoutingLogProgress(0, 200, 1000);
        nowSpy.mockReturnValue(2000);

        logger.afterOdTrip(99, 100);
        expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
        stdoutWriteSpy.mockClear();
        logger.afterOdTrip(100, 101);

        expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    test('afterOdTrip respects startIndex for done count and percentage', () => {
        const nowSpy = jest.spyOn(performance, 'now');
        nowSpy.mockReturnValue(0);
        const logger = new InteractiveBatchRoutingLogProgress(10, 90, 0);
        nowSpy.mockReturnValue(1000);

        logger.afterOdTrip(44, 55);

        expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
        const written = String(stdoutWriteSpy.mock.calls[0][0]);
        expect(written).toContain('50%');
        expect(written).toContain('45/90');
    });

    test('end writes a newline', () => {
        jest.spyOn(performance, 'now').mockReturnValue(0);
        const logger = new InteractiveBatchRoutingLogProgress(0, 10, 0);
        stdoutWriteSpy.mockClear();

        logger.end();

        expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
    });

    test('beforeOdTrip does not write to stdout', () => {
        jest.spyOn(performance, 'now').mockReturnValue(0);
        const logger = new InteractiveBatchRoutingLogProgress(0, 10, 0);

        logger.beforeOdTrip(0);

        expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });
});

describe('NonInteractiveBatchRoutingLogProgress', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { /* noop */ });
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        jest.restoreAllMocks();
    });

    test('beforeOdTrip logs Routing odTrip when (index+1) is a multiple of progressStep', () => {
        const logger = new NonInteractiveBatchRoutingLogProgress(1000, 0, 10, 0);

        logger.beforeOdTrip(8);
        expect(consoleLogSpy).not.toHaveBeenCalled();

        logger.beforeOdTrip(9);
        expect(consoleLogSpy).toHaveBeenCalledWith('Routing odTrip 10/1000');
    });

    test('afterOdTrip logs calc/sec every 100 trips when odTripIndex matches and benchmarkStart >= 0', () => {
        const nowSpy = jest.spyOn(performance, 'now');
        nowSpy.mockReturnValueOnce(1000);
        const logger = new NonInteractiveBatchRoutingLogProgress(500, 0, 50, 0);
        nowSpy.mockReturnValue(3000);

        logger.afterOdTrip(100, 101);

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        expect(String(consoleLogSpy.mock.calls[0][0])).toMatch(/^calc\/sec: \d+(\.\d+)? \(current: \d+(\.\d+)?\)$/);
    });

    test('afterOdTrip does not log calc/sec for index 0 or non-multiples of 100', () => {
        jest.spyOn(performance, 'now').mockReturnValue(2000);
        const logger = new NonInteractiveBatchRoutingLogProgress(200, 0, 1, 0);

        logger.afterOdTrip(0, 1);
        logger.afterOdTrip(50, 51);
        logger.afterOdTrip(99, 100);

        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('afterOdTrip with small indices and end do not call console.log', () => {
        jest.spyOn(performance, 'now').mockReturnValue(1000);
        const logger = new NonInteractiveBatchRoutingLogProgress(10, 0, 1, 0);

        logger.afterOdTrip(4, 5);
        logger.end();

        expect(consoleLogSpy).not.toHaveBeenCalled();
    });
});
