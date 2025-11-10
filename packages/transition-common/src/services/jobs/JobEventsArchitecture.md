# Job Events Architecture

This document describes the event-based communication architecture for the ExecutableJob and workerpool infrastructure.

## Overview

The job execution system uses event-driven communication to coordinate between:
- **Tasks**: The actual work being performed (e.g., `TrRoutingBatch`, accessibility map calculations)
- **ExecutableJob**: Manages job lifecycle, status, data, and files
- **Worker Threads**: Execute tasks in isolation using the workerpool library
- **Main Thread**: Coordinates job execution and communicates with consumers
- **Consumers**: UI or other jobs that need to be notified of job progress and status

## Communication Patterns

### Worker to Main Thread

Communication from worker threads to the main thread uses `workerpool.workerEmit()`. This is a one-way communication channel provided by the workerpool library.

```typescript
import workerpool from 'workerpool';
import { createWorkerEventPayload, JobEventNames } from './JobEvents';

// In worker thread
workerpool.workerEmit(createWorkerEventPayload(JobEventNames.PROGRESS, {
    name: 'myTask',
    progress: 0.5
}));
```

### Main to Worker Thread

The workerpool library does not provide a direct way to send events from main to worker threads. Instead, workers must **poll the database** to detect changes like cancellation or deletion.

```typescript
// Worker thread polls for cancellation
const intervalObj = setInterval(() => {
    task.refresh()
        .then(() => {
            if (task.status !== 'inProgress') {
                clearInterval(intervalObj);
            }
        })
        .catch(() => console.error('Error refreshing task'));
}, 5000); // Poll every 5 seconds
```

## Event Categories

### Internal Events

These events are used only by the job execution framework and are not exposed to consumers:

- **`checkpoint`**: Emitted by tasks to save progress for resumption after restart
  - Handled by the worker thread to update job's `internal_data.checkpoint`
  - Not forwarded to consumers

### Consumer Events

These events are forwarded to job consumers (UI, other jobs) to track progress and lifecycle:

- **Progress Events**:
  - `progress`: Percentage-based progress (0 to 1.0)
  - `progressCount`: Count-based progress (useful for "X of Y" displays)

- **Job Lifecycle Events**:
  - `executableJob.created`: Job was created
  - `executableJob.updated`: Generic job update (deprecated, use specific events)
  - `executableJob.statusChanged`: Job status changed
  - `executableJob.cancelled`: Job was cancelled
  - `executableJob.completed`: Job completed successfully
  - `executableJob.failed`: Job failed with error
  - `executableJob.deleted`: Job was deleted

- **Error Events**:
  - `error`: Error occurred during execution

## Event Flow

### 1. Task Execution in Worker Thread

```
Task (e.g., TrRoutingBatch)
    ↓ emits 'progress'
Progress Event Emitter
    ↓ caught by listener
workerpool.workerEmit({ event: 'progress', data: {...} })
    ↓ forwarded to main thread
Main Thread Listener
    ↓ re-emits on user's event emitter
Job Consumer (UI/Socket)
```

### 2. Checkpoint Flow (Internal)

```
Task
    ↓ emits 'checkpoint'
Checkpoint Event Emitter
    ↓ caught by listener
task.refresh() → Update internal_data.checkpoint → task.save()
    (Not forwarded to consumers)
```

### 3. Job Status Change Flow

```
ExecutableJob (in worker)
    ↓ status changed (e.g., setCompleted())
task.save(jobListener)
    ↓ emits 'executableJob.updated'
workerpool.workerEmit({ event: 'executableJob.updated', data: {...} })
    ↓ forwarded to main thread
Main Thread Listener
    ↓ re-emits on user's event emitter
Job Consumer (UI/Socket)
```

## Event Listeners

### Task to Worker Communication

Tasks are not aware of threads and emit events to an EventEmitter:

```typescript
// In TransitionWorkerPool.ts
function newProgressEmitter(task: ExecutableJob<JobDataType>) {
    const eventEmitter = new EventEmitter();
    
    // Forward progress events
    eventEmitter.on(JobEventNames.PROGRESS, (progressData: ProgressEventData) => {
        workerpool.workerEmit(createWorkerEventPayload(JobEventNames.PROGRESS, progressData));
    });
    
    // Handle checkpoints internally
    eventEmitter.on(JobEventNames.CHECKPOINT, (data: CheckpointEventData) => {
        task.refresh()
            .then(() => {
                task.attributes.internal_data.checkpoint = data.checkpoint;
                task.save().catch(() => console.error('Error saving checkpoint'));
            })
            .catch(() => console.error('Error refreshing task'));
    });
    
    return eventEmitter;
}
```

### Worker to Main Communication

The workerpool's `on` callback receives events from workers:

```typescript
// In ExecutableJob.enqueue()
execJob('task', [this.attributes.id], {
    on: function (payload: WorkerEventPayload<JobEventName>) {
        // Emit event on user's event emitter
        jobProgressEmitter.emit(payload.event, payload.data);
    }
});
```

### Consumer Listeners

Consumers can listen to events through the user's event emitter:

```typescript
// Get user-specific event emitter
const userEventEmitter = clientEventManager.getUserEventEmitter(userId);

// Listen to job progress
userEventEmitter.on(JobEventNames.PROGRESS, (data: ProgressEventData) => {
    console.log(`Job progress: ${data.progress * 100}%`);
});

// Listen to job completion
userEventEmitter.on(JobEventNames.JOB_COMPLETED, (data: JobCompletedEventData) => {
    console.log(`Job ${data.id} completed`);
});
```

### Automatic Reconnection for Offline Users

When a job is enqueued at server start (e.g., resuming after restart), users may not be online. The `ClientEventManager` automatically forwards events to users when they reconnect:

```typescript
// In ClientEventManager.ts
getUserEventEmitter(userId: number) {
    const eventEmitter = this._eventEmitterByUser[userId];
    if (eventEmitter !== undefined) {
        return eventEmitter;
    }
    
    const newEventEmitter = new EventEmitter();
    ConsumerJobEvents.forEach((event) => {
        newEventEmitter.on(event, (payload) => {
            const sockets = this._socketsByUser[userId] || [];
            sockets.forEach((socket) => socket.emit(event, payload));
        });
    });
    
    this._eventEmitterByUser[userId] = newEventEmitter;
    return newEventEmitter;
}
```

## Future: Parent-Child Job Coordination

For network design scenarios that create sub-jobs, the architecture will need to support:

1. **Job Yielding**: A parent job pauses while children execute
2. **Re-enqueuing**: Parent job is re-enqueued when all children complete/fail
3. **Job-to-Job Communication**: Parent jobs listen to child job events

This will be implemented by:
- Adding a `parentJobId` field to job attributes
- Having the ExecutableJob framework listen to all job updates
- Implementing re-enqueuing logic when child jobs complete

## Type Safety

All events are typed using TypeScript to ensure compile-time safety:

```typescript
// Type-safe event emission
function emitProgress(emitter: EventEmitter, data: ProgressEventData) {
    emitter.emit(JobEventNames.PROGRESS, data);
}

// Type-safe event listening
function listenToProgress(emitter: EventEmitter, 
                         callback: (data: ProgressEventData) => void) {
    emitter.on(JobEventNames.PROGRESS, callback);
}
```

## Best Practices

1. **Always include job ID in payloads**: A single listener may be listening to multiple jobs
2. **Use specific lifecycle events**: Prefer `executableJob.completed` over `executableJob.updated` with status check
3. **Keep checkpoint events internal**: Don't expose implementation details to consumers
4. **Poll for cancellation in workers**: Check job status regularly to detect cancellation
5. **Handle offline users**: Use ClientEventManager to ensure events reach users when they reconnect

## References

- `JobEvents.ts`: Type definitions for all events
- `ExecutableJob.ts`: Job lifecycle management
- `TransitionWorkerPool.ts`: Worker thread coordination
- `ClientEventManager.ts`: User event distribution
- `Notifications.ts`: UI notification handling
