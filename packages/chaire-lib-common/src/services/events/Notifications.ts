/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'stream';
import serviceLocator from '../../utils/ServiceLocator';

/**
 * Base interface for the notification service. This handles the operation
 * progress and error notifications from the system.
 *
 * Listeners will be notified of any notification in the system and can act on
 * those. For example, it could be notification to the user, or it could log
 * notifications somewhere.
 */
export interface NotificationService {
    addListener: (callback: (notification: Notification) => void) => void;
    removeListener: (callback: (notification: Notification) => void) => void;
    registerEventsOnEmitter: (eventEmitter: EventEmitter) => void;
    deregisterEventsOnEmitter: (eventEmitter: EventEmitter) => void;
}

export type Notification =
    | {
          type: 'error';
          name: string;
          message: string[];
      }
    | {
          type: 'progress';
          name: string;
          message: string[];
          done: boolean;
      };

class NotificationServiceImpl implements NotificationService {
    private _listeners: ((notifications: Notification) => void)[] = [];

    constructor() {
        if (serviceLocator.eventManager) {
            this.registerEventsOnEmitter(serviceLocator.eventManager);
        }
        if (serviceLocator.socketEventManager) {
            this.registerEventsOnEmitter(serviceLocator.socketEventManager);
        }
    }

    registerEventsOnEmitter = (eventEmitter: EventEmitter) => {
        // Event names are defined in JobEvents.ts (transition-common package)
        // Using string literals here for compatibility with chaire-lib-common
        eventEmitter.on('progress', this.progressNotification);
        eventEmitter.on('progressCount', this.progressCountNotification);
        eventEmitter.on('error', this.errorNotification);
    };

    deregisterEventsOnEmitter = (eventEmitter: EventEmitter) => {
        // Event names are defined in JobEvents.ts (transition-common package)
        // Using string literals here for compatibility with chaire-lib-common
        eventEmitter.off('progress', this.progressNotification);
        eventEmitter.off('progressCount', this.progressCountNotification);
        eventEmitter.off('error', this.errorNotification);
    };

    addListener = (callback: (notifications: Notification) => void): void => {
        this._listeners.push(callback);
    };

    removeListener = (callback: (notifications: Notification) => void): void => {
        const index = this._listeners.indexOf(callback);
        if (index < 0) {
            return;
        }
        this._listeners.splice(index, 1);
    };

    progressNotification = (progressData: { name: string; customText?: string; progress: number }) => {
        const newNotification = {
            type: 'progress' as const,
            name: progressData.name,
            message: [
                `notifications:${progressData.name}`,
                progressData.customText
                    ? progressData.customText
                    : progressData.progress === null
                        ? 'notifications:pending'
                        : `${Math.round(progressData.progress * 100)}%`
            ],
            done: progressData.progress === 1.0
        };
        this.notifyListeners(newNotification);
    };

    progressCountNotification = (progressData: { name: string; customText?: string; progress: number }) => {
        const newNotification = {
            type: 'progress' as const,
            name: progressData.name,
            message: [
                `notifications:${progressData.name}`,
                progressData.customText ? progressData.customText : String(progressData.progress)
            ],
            done: progressData.progress === -1
        };
        this.notifyListeners(newNotification);
    };

    private errorNotification = (progressData: { name: string; error: string }) => {
        const newNotification = {
            type: 'error' as const,
            name: progressData.name,
            message: [`notifications:${progressData.name}`, `notifications:${progressData.error}`]
        };
        this.notifyListeners(newNotification);
    };

    private notifyListeners = (notification: Notification) => {
        this._listeners.forEach((listener) => listener(notification));
    };
}

export default NotificationServiceImpl;
