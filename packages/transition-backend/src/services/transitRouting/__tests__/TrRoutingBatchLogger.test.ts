/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { performance } from 'perf_hooks';

import {
    BatchRoutingLogProgress,
    BatchRoutingLogProgressParams,
    createBatchRoutingLogProgress
} from '../TrRoutingBatchLogger';

const buildParams = (overrides: Partial<BatchRoutingLogProgressParams> = {}): BatchRoutingLogProgressParams => ({
    odTripsCount: 100,
    startIndex: 0,
    ...overrides
});

const originalIsTTY = process.stdout.isTTY;

const setIsTTY = (isTTY: boolean | undefined): void => {
    Object.defineProperty(process.stdout, 'isTTY', { value: isTTY, configurable: true });
};

afterEach(() => {
    setIsTTY(originalIsTTY);
    jest.restoreAllMocks();
});

describe('createBatchRoutingLogProgress: interactive (TTY) variant', () => {
    let stdoutWriteSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    const makeLogger = (params?: Partial<BatchRoutingLogProgressParams>): BatchRoutingLogProgress => {
        setIsTTY(true);
        return createBatchRoutingLogProgress(buildParams(params));
    };

    beforeEach(() => {
        stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
            /* noop */
        });
    });

    test('afterOdTrip writes a progress line when percentage increases', () => {
        // 1st call: ctor benchmarkStart=0; 2nd call: afterOdTrip elapsed=1000ms
        jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(1000);
        const logger = makeLogger({ odTripsCount: 100 });

        logger.afterOdTrip(49, 50);

        expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
        const written = String(stdoutWriteSpy.mock.calls[0][0]);
        expect(written).toContain('\r');
        expect(written).toContain('50%');
        expect(written).toContain('50/100');
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('afterOdTrip does not write when floor percentage did not increase', () => {
        // 1st call: ctor; 2nd call: first afterOdTrip; second afterOdTrip
        // early-returns before calling now().
        jest.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);
        const logger = makeLogger({ odTripsCount: 200 });

        logger.afterOdTrip(99, 100);
        expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
        stdoutWriteSpy.mockClear();
        logger.afterOdTrip(100, 101);

        expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    test('afterOdTrip respects startIndex: totalToRoute = odTripsCount - startIndex', () => {
        jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(1000);
        // odTripsCount=100, startIndex=10 => totalToRoute=90
        const logger = makeLogger({ odTripsCount: 100, startIndex: 10 });

        logger.afterOdTrip(44, 55);

        expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
        const written = String(stdoutWriteSpy.mock.calls[0][0]);
        expect(written).toContain('50%');
        expect(written).toContain('45/90');
    });

    test('end writes a newline', () => {
        jest.spyOn(performance, 'now').mockReturnValue(0);
        const logger = makeLogger({ odTripsCount: 10 });
        stdoutWriteSpy.mockClear();

        logger.end();

        expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
    });

    test('beforeOdTrip does not write to stdout', () => {
        jest.spyOn(performance, 'now').mockReturnValue(0);
        const logger = makeLogger({ odTripsCount: 10 });

        logger.beforeOdTrip(0);

        expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    // Empty-batch edge case: when startIndex === odTripsCount (e.g., resuming a
    // job from a checkpoint that already completed), totalToRoute is 0. The
    // production loop in TrRoutingBatch does not call the logger in that case,
    // but the class still guards against division by zero in afterOdTrip.
    test('afterOdTrip is a silent no-op when totalToRoute is 0 (odTripsCount === startIndex)', () => {
        jest.spyOn(performance, 'now').mockReturnValue(0);
        const logger = makeLogger({ odTripsCount: 100, startIndex: 100 });

        expect(() => logger.afterOdTrip(100, 100)).not.toThrow();

        expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });
});

describe('createBatchRoutingLogProgress: non-interactive (pipe/CI) variant', () => {
    let stdoutWriteSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    const makeLogger = (params?: Partial<BatchRoutingLogProgressParams>): BatchRoutingLogProgress => {
        setIsTTY(false);
        return createBatchRoutingLogProgress(buildParams(params));
    };

    beforeEach(() => {
        stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
            /* noop */
        });
    });

    // The logger derives its own progressStep from odTripsCount: 1% of the
    // batch, capped at 500 trips between two log lines.
    test.each([
        {
            description: '1000 trips => step=10, (8+1)%10!=0 so no log',
            odTripsCount: 1000,
            index: 8,
            expectedLog: undefined
        },
        {
            description: '1000 trips => step=10, (9+1)%10==0 logs at trip 10',
            odTripsCount: 1000,
            index: 9,
            expectedLog: 'Routing odTrip 10/1000'
        },
        {
            description: '1000 trips => step=10, next multiple at trip 20',
            odTripsCount: 1000,
            index: 19,
            expectedLog: 'Routing odTrip 20/1000'
        },
        {
            description: '500 trips => step=5, smaller batch yields smaller step',
            odTripsCount: 500,
            index: 4,
            expectedLog: 'Routing odTrip 5/500'
        },
        {
            description: '100000 trips => step capped at 500 (would be 1000 without cap)',
            odTripsCount: 100000,
            index: 499,
            expectedLog: 'Routing odTrip 500/100000'
        }
    ])('beforeOdTrip: $description', ({ odTripsCount, index, expectedLog }) => {
        const logger = makeLogger({ odTripsCount });

        logger.beforeOdTrip(index);

        if (expectedLog !== undefined) {
            expect(consoleLogSpy).toHaveBeenCalledWith(expectedLog);
        } else {
            expect(consoleLogSpy).not.toHaveBeenCalled();
        }
        expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    test('afterOdTrip logs calc/sec every 100 trips', () => {
        // 1st call: ctor benchmarkStart=lastLogTime=1000; 2nd call: afterOdTrip
        jest.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(3000);
        const logger = makeLogger({ odTripsCount: 500 });

        logger.afterOdTrip(100, 101);

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        expect(String(consoleLogSpy.mock.calls[0][0])).toMatch(/^calc\/sec: \d+(\.\d+)? \(current: \d+(\.\d+)?\)$/);
    });

    test.each([
        { odTripIndex: 0, completed: 1, description: 'index 0' },
        { odTripIndex: 50, completed: 51, description: 'non-multiple of 100 (50)' },
        { odTripIndex: 99, completed: 100, description: 'non-multiple of 100 (99)' }
    ])('afterOdTrip does not log calc/sec for $description', ({ odTripIndex, completed }) => {
        jest.spyOn(performance, 'now').mockReturnValue(2000);
        const logger = makeLogger({ odTripsCount: 200 });

        logger.afterOdTrip(odTripIndex, completed);

        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('end does not call console.log and does not write to stdout', () => {
        jest.spyOn(performance, 'now').mockReturnValue(1000);
        const logger = makeLogger({ odTripsCount: 10 });

        logger.end();

        expect(consoleLogSpy).not.toHaveBeenCalled();
        expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });
});

describe('createBatchRoutingLogProgress: variant selection', () => {
    let stdoutWriteSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
            /* noop */
        });
        jest.spyOn(performance, 'now').mockReturnValue(0);
    });

    // The two variants are distinguishable by observable behavior:
    // - interactive writes to stdout (newline) on end()
    // - non-interactive logs "Routing odTrip" on beforeOdTrip when step matches
    //   and writes nothing to stdout on end()
    test.each([
        { isTTY: true, variant: 'interactive' },
        { isTTY: false, variant: 'non-interactive' },
        { isTTY: undefined, variant: 'non-interactive' }
    ])('selects $variant when process.stdout.isTTY is $isTTY', ({ isTTY, variant }) => {
        setIsTTY(isTTY);
        const logger = createBatchRoutingLogProgress(buildParams({ odTripsCount: 10 }));

        logger.beforeOdTrip(0);
        logger.end();

        if (variant === 'interactive') {
            expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        } else {
            // odTripsCount=10 => step=1, so beforeOdTrip(0) logs "Routing odTrip 1/10"
            expect(consoleLogSpy).toHaveBeenCalledWith('Routing odTrip 1/10');
            expect(stdoutWriteSpy).not.toHaveBeenCalled();
        }
    });
});
