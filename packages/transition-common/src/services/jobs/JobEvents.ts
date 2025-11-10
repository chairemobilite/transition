/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * This file defines the API for communication between worker and main threads
 * in the ExecutableJob/workerpool architecture. It provides typed events for
 * job lifecycle management, progress tracking, and checkpoint handling.
 *
 * Events are categorized into:
 * - Internal events: Used only by the job execution framework (e.g., checkpoints)
 * - Consumer events: Events that job consumers (UI, other jobs) should listen to
 *
 * Communication from worker thread to main thread is through the workerpool.workerEmit function.
 * The main thread cannot directly send events to the worker thread, so workers must poll
 * the database to detect changes like cancellation or deletion.
 */

/**
 * Progress event data sent from the task execution to notify of task progress.
 * This is emitted by tasks and forwarded to consumers (like the UI).
 */
export type ProgressEventData = {
    /** Name of the task emitting progress */
    name: string;
    /** Custom text to display (optional) */
    customText?: string;
    /** Progress value between 0 and 1.0 (1.0 means completed) */
    progress: number;
};

/**
 * Progress count event data for tasks that track progress by count rather than percentage.
 */
export type ProgressCountEventData = {
    /** Name of the task emitting progress */
    name: string;
    /** Custom text to display (optional) */
    customText?: string;
    /** Progress count value (-1 means completed) */
    progress: number;
};

/**
 * Checkpoint event data for internal task state management.
 * This is an internal event used to save task progress to resume after restart.
 */
export type CheckpointEventData = {
    /** The checkpoint value (typically an index or counter) */
    checkpoint: number;
};

/**
 * Base payload for all job update events, containing the job identifier.
 * All job lifecycle events should include at least this information.
 */
export type JobUpdateBasePayload = {
    /** Job ID */
    id: number;
    /** Job name */
    name: string;
};

/**
 * Payload for job created event.
 */
export type JobCreatedEventData = JobUpdateBasePayload & {
    /** User ID who created the job */
    userId: number;
};

/**
 * Payload for job updated event (generic update, may include status or data changes).
 * This is the current catch-all event, but should be deprecated in favor of specific events.
 */
export type JobUpdatedEventData = JobUpdateBasePayload;

/**
 * Payload for job status change events.
 */
export type JobStatusEventData = JobUpdateBasePayload & {
    /** New status of the job */
    status: 'pending' | 'inProgress' | 'completed' | 'failed' | 'cancelled';
};

/**
 * Payload for job cancelled event.
 */
export type JobCancelledEventData = JobUpdateBasePayload;

/**
 * Payload for job completed event.
 */
export type JobCompletedEventData = JobUpdateBasePayload;

/**
 * Payload for job failed event.
 */
export type JobFailedEventData = JobUpdateBasePayload & {
    /** Optional error message */
    error?: string;
};

/**
 * Payload for job deleted event.
 */
export type JobDeletedEventData = JobUpdateBasePayload;

/**
 * Error event data for task execution errors.
 */
export type ErrorEventData = {
    /** Name of the operation that errored */
    name: string;
    /** Error message or code */
    error: string;
};

/**
 * Enumeration of all job-related event names.
 * These are the events that can be emitted during job lifecycle and execution.
 */
export const JobEventNames = {
    // Progress events (consumer-facing)
    /** Progress update from task execution (percentage-based) */
    PROGRESS: 'progress',
    /** Progress update from task execution (count-based) */
    PROGRESS_COUNT: 'progressCount',

    // Internal events (framework-only)
    /** Checkpoint saved for task resumption */
    CHECKPOINT: 'checkpoint',

    // Job lifecycle events (consumer-facing)
    /** Job was created */
    JOB_CREATED: 'executableJob.created',
    /** Job was updated (generic, should be deprecated) */
    JOB_UPDATED: 'executableJob.updated',
    /** Job status changed */
    JOB_STATUS_CHANGED: 'executableJob.statusChanged',
    /** Job was cancelled */
    JOB_CANCELLED: 'executableJob.cancelled',
    /** Job completed successfully */
    JOB_COMPLETED: 'executableJob.completed',
    /** Job failed */
    JOB_FAILED: 'executableJob.failed',
    /** Job was deleted */
    JOB_DELETED: 'executableJob.deleted',

    // Error events
    /** Error occurred during execution */
    ERROR: 'error'
} as const;

/**
 * Type for event names (string literal union type).
 */
export type JobEventName = typeof JobEventNames[keyof typeof JobEventNames];

/**
 * Map of event names to their payload types.
 * This provides type safety when emitting and listening to events.
 */
export type JobEventPayloadMap = {
    [JobEventNames.PROGRESS]: ProgressEventData;
    [JobEventNames.PROGRESS_COUNT]: ProgressCountEventData;
    [JobEventNames.CHECKPOINT]: CheckpointEventData;
    [JobEventNames.JOB_CREATED]: JobCreatedEventData;
    [JobEventNames.JOB_UPDATED]: JobUpdatedEventData;
    [JobEventNames.JOB_STATUS_CHANGED]: JobStatusEventData;
    [JobEventNames.JOB_CANCELLED]: JobCancelledEventData;
    [JobEventNames.JOB_COMPLETED]: JobCompletedEventData;
    [JobEventNames.JOB_FAILED]: JobFailedEventData;
    [JobEventNames.JOB_DELETED]: JobDeletedEventData;
    [JobEventNames.ERROR]: ErrorEventData;
};

/**
 * Consumer-facing events that job consumers (UI, other jobs) should listen to.
 * These events provide information about job progress and lifecycle that is
 * relevant to external consumers.
 */
export const ConsumerJobEvents: ReadonlyArray<JobEventName> = [
    JobEventNames.PROGRESS,
    JobEventNames.PROGRESS_COUNT,
    JobEventNames.JOB_CREATED,
    JobEventNames.JOB_UPDATED,
    JobEventNames.JOB_STATUS_CHANGED,
    JobEventNames.JOB_CANCELLED,
    JobEventNames.JOB_COMPLETED,
    JobEventNames.JOB_FAILED,
    JobEventNames.JOB_DELETED,
    JobEventNames.ERROR
] as const;

/**
 * Internal events used only by the job execution framework.
 * These events are for framework internals like checkpoint management
 * and should not be exposed to job consumers.
 */
export const InternalJobEvents: ReadonlyArray<JobEventName> = [
    JobEventNames.CHECKPOINT
] as const;

/**
 * Type-safe event emitter interface for job events.
 * This interface can be used to ensure type safety when emitting events.
 */
export interface JobEventEmitter {
    emit<K extends JobEventName>(
        event: K,
        payload: JobEventPayloadMap[K]
    ): boolean;

    on<K extends JobEventName>(
        event: K,
        listener: (payload: JobEventPayloadMap[K]) => void
    ): this;

    off<K extends JobEventName>(
        event: K,
        listener: (payload: JobEventPayloadMap[K]) => void
    ): this;
}

/**
 * Payload structure for worker-to-main thread communication via workerpool.workerEmit.
 * This wraps the event name and data for transmission through the worker pool.
 */
export type WorkerEventPayload<K extends JobEventName> = {
    /** The event name */
    event: K;
    /** The event data */
    data: JobEventPayloadMap[K];
};

/**
 * Helper function to create a worker event payload for workerpool.workerEmit.
 * This ensures type safety when emitting events from worker threads.
 *
 * @example
 * ```typescript
 * workerpool.workerEmit(createWorkerEventPayload(JobEventNames.PROGRESS, {
 *   name: 'myTask',
 *   progress: 0.5
 * }));
 * ```
 */
export function createWorkerEventPayload<K extends JobEventName>(
    event: K,
    data: JobEventPayloadMap[K]
): WorkerEventPayload<K> {
    return { event, data };
}
