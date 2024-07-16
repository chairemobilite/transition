/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

/**
 * Class that allows to keep track of task execution progress. Ideal for jobs
 * that include individual steps, this allows to inform the task when a chunk
 * has been completed and save this checkpoint.
 *
 * Using this class is suggested for asynchronous steps, where steps can be
 * completed out of order, to keep track of each individual step. Listeners can
 * listen to the 'checkpoint' event.
 */
export class CheckpointTracker {
    private indexes: number[] = [];
    private lastCheckpointIdx: number;

    /**
     * Constructor
     * @param chunkSize Number of steps in a chunk.
     * @param progressEmitter event emitter that will be notified when chunks
     * are finished. It will send a 'checkpoint' event with the checkpoint, ie
     * chunk size * nb of terminated chunks
     * @param currentCheckpoint If resuming a task, this is the last checkpoint
     * that was registered in previous run
     */
    constructor(
        private chunkSize: number,
        private progressEmitter: EventEmitter,
        currentCheckpoint = 0
    ) {
        this.lastCheckpointIdx = Math.floor(currentCheckpoint / chunkSize) - 1;
        // Add items to the last checkpoint, in case the chunk size is not a multiple of the current checkpoint
        const lastChunkItems = currentCheckpoint % chunkSize;
        if (lastChunkItems > 0) {
            this.indexes[this.lastCheckpointIdx + 1] = lastChunkItems;
        }
    }

    /**
     * Tell the tracker that the step at index was completed
     * @param handledIndex 0-based index of the step that was just completed
     */
    handled = (handledIndex: number): void => {
        if (handledIndex < 0) {
            console.log('Invalid index received in checkpoint tracker', handledIndex);
            return;
        }
        // Increment the count for this checkpoint
        const chkIndex = this.getCheckpointIndex(handledIndex);
        this.indexes[chkIndex] = (this.indexes[chkIndex] || 0) + 1;
        if (this.indexes[chkIndex] === this.chunkSize) {
            // See if we need to notify for this checkopint
            this.maybeNotifyCheckpoint(chkIndex);
        }
    };

    private getCheckpointIndex = (handledIndex: number) => {
        return Math.floor(handledIndex / this.chunkSize);
    };

    private maybeNotifyCheckpoint(chkIndex: number) {
        // If the previous checkpoint is completed, then notify for the next
        // checkpoint, otherwise do nothing, we need to wait for the previous to
        // complete first
        console.log('Maybe notify checkpoint at index', chkIndex, this.lastCheckpointIdx);
        if (this.lastCheckpointIdx === chkIndex - 1) {
            let indexToNotify = chkIndex;
            // Get the last completed checkpoint
            while (this.indexes[indexToNotify + 1] === this.chunkSize) {
                indexToNotify++;
            }
            console.log('Emitting checkpoint at index ', chkIndex);
            this.progressEmitter.emit('checkpoint', (indexToNotify + 1) * this.chunkSize);
            this.lastCheckpointIdx = indexToNotify;
        }
    }

    /**
     * Call when all steps have been completed. If the last chunk is not full,
     * it will emit a 'checkpoint' event with the last index handled.
     */
    completed = (): void => {
        const lastChunkIndex = this.lastCheckpointIdx + 1;
        const lastChunkSize = this.indexes[lastChunkIndex];
        if (lastChunkSize !== undefined && lastChunkSize > 0) {
            this.progressEmitter.emit('checkpoint', lastChunkIndex * this.chunkSize + lastChunkSize);
        }
    };
}
