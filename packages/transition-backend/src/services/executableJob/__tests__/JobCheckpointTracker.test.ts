/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { CheckpointTracker } from '../JobCheckpointTracker';
import { JobEventNames } from 'transition-common/lib/services/jobs/JobEvents';

const mockProgressEmitter = new EventEmitter();
const mockCheckpoint = jest.fn();
mockProgressEmitter.on(JobEventNames.CHECKPOINT, mockCheckpoint);

beforeEach(() => {
    mockCheckpoint.mockClear();
})

test('Test smaller number of handled data than chunk size', () => {
    const tracker = new CheckpointTracker(10, mockProgressEmitter);
    tracker.handled(0);
    tracker.handled(1);
    tracker.handled(2);
    expect(mockCheckpoint).not.toHaveBeenCalled();
});

test('Test in order step completion', () => {
    const chunkSize = 5;
    const tracker = new CheckpointTracker(chunkSize, mockProgressEmitter);
    for (let i = 0; i < 2 * chunkSize; i++) {
        tracker.handled(i);
    }
    expect(mockCheckpoint).toHaveBeenCalledTimes(2);
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: chunkSize });
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 2 * chunkSize });
});

test('Test out of order step completion', () => {
    const chunkSize = 5;
    const tracker = new CheckpointTracker(chunkSize, mockProgressEmitter);
    // handle the first 4
    for (let i = 0; i < chunkSize - 1; i++) {
        tracker.handled(i);
    }
    // handle 6th, make sure the checkpoint has not been called
    tracker.handled(5);
    expect(mockCheckpoint).not.toHaveBeenCalled();

    // handle 5th, the checkpoint should have been called now
    tracker.handled(4);
    expect(mockCheckpoint).toHaveBeenCalledTimes(1);
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 5 });
});

test('Finish second chunk before first', () => {
    const chunkSize = 5;
    const tracker = new CheckpointTracker(chunkSize, mockProgressEmitter);
    // handle the first 4
    for (let i = 0; i < 4; i++) {
        tracker.handled(i);
    }
    // handle 6th through 10th, make sure the checkpoint has not been called
    for (let i = 5; i < 10; i++) {
        tracker.handled(i);
    }
    expect(mockCheckpoint).not.toHaveBeenCalled();

    // handle 5th, the checkpoint should have been called now, with number 10
    tracker.handled(4);
    expect(mockCheckpoint).toHaveBeenCalledTimes(1);
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 2 * chunkSize });
});

test('Test the completed method', () => {
    const chunkSize = 5;
    const extraItems = chunkSize - 2;
    const tracker = new CheckpointTracker(chunkSize, mockProgressEmitter);
    // handle 2 chunks + a few items less
    for (let i = 0; i < (2 * chunkSize) + extraItems; i++) {
        tracker.handled(i);
    }
    // Expect the 2 checkpoints to have been called
    expect(mockCheckpoint).toHaveBeenCalledTimes(2);
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: chunkSize });
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 2 * chunkSize });

    // Call the completed method, expect a third checkpoint call
    tracker.completed();
    expect(mockCheckpoint).toHaveBeenCalledTimes(3);
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 2 * chunkSize + extraItems });
});

test('Resume from checkpoint, multiple of chunk size', () => {
    const chunkSize = 5;
    const lastCheckpoint = 2 * chunkSize;
    const tracker = new CheckpointTracker(chunkSize, mockProgressEmitter, lastCheckpoint);
    // handle 2 other chunks
    for (let i = lastCheckpoint; i <= 4 * chunkSize; i++) {
        tracker.handled(i);
    }
    // Expect the 2 checkpoints to have been called
    expect(mockCheckpoint).toHaveBeenCalledTimes(2);
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 3 * chunkSize });
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 4 * chunkSize });
});

test('Resume from checkpoint, with extra elements', () => {
    const chunkSize = 5;
    const lastCheckpoint = 2 * chunkSize + 2;
    const tracker = new CheckpointTracker(chunkSize, mockProgressEmitter, lastCheckpoint);
    // handle 2 other chunks
    for (let i = lastCheckpoint; i <= 4 * chunkSize; i++) {
        tracker.handled(i);
    }
    // Expect the 2 checkpoints to have been called
    expect(mockCheckpoint).toHaveBeenCalledTimes(2);
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 3 * chunkSize });
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 4 * chunkSize });
});

test('Resume from checkpoint, smaller than chunk size', () => {
    const chunkSize = 5;
    const lastCheckpoint = chunkSize - 2;
    const tracker = new CheckpointTracker(chunkSize, mockProgressEmitter, lastCheckpoint);
    // handle 2 other chunks
    for (let i = lastCheckpoint; i <= 2 * chunkSize; i++) {
        tracker.handled(i);
    }
    // Expect the 2 checkpoints to have been called
    expect(mockCheckpoint).toHaveBeenCalledTimes(2);
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: chunkSize });
    expect(mockCheckpoint).toHaveBeenCalledWith({ checkpoint: 2 * chunkSize });
});
