/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import each from 'jest-each';

import NotificationService from '../Notifications';
import serviceLocator from '../../../utils/ServiceLocator';

jest.mock('../../../utils/ServiceLocator', () => ({
    socketEventManager: new EventEmitter(),
    eventManager: new EventEmitter()
}));

const notificationService = new NotificationService();

describe('No listener', () => {
    // No way to validate the received data, these tests just make sure no exception is thrown in this case
    test('error notification', () => {
        serviceLocator.socketEventManager.emit('error', { name: 'test', error: 'there was an error' });
        serviceLocator.eventManager.emit('error', { name: 'test', error: 'there was an error' })
    });

    test('progress notification', () => {
        serviceLocator.socketEventManager.emit('progress', { name: 'test', progress: 0.3 });
        serviceLocator.eventManager.emit('progress', { name: 'test', progress: 0.3 });
    });

    test('progress count notification', () => {
        serviceLocator.socketEventManager.emit('progressCount', { name: 'test', progress: 3 });
        serviceLocator.eventManager.emit('progressCount', { name: 'test', progress: 3 });
    });
});

each([
    ['socketEventManager', serviceLocator.socketEventManager],
    ['eventManager', serviceLocator.eventManager]
]).describe('Single listener, detailed tests', (_name, eventEmitter) => {
    const listener1 = jest.fn();
    notificationService.addListener(listener1);

    beforeEach(() => {
        listener1.mockClear();
    })
    
    test('error notification', () => {
        const error = { name: 'foo', error: 'there was an error' };
        const error2 = { name: 'bar', error: 'there was an error' };
        const error3 = { name: 'bar', error: 'This is a new error' };

        // Emit a first event
        eventEmitter.emit('error', error);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error.name, message: [`notifications:${error.name}`, `notifications:${error.error}`] });
        
        // Emit a second event
        eventEmitter.emit('error', error2);
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error2.name, message: [`notifications:${error2.name}`, `notifications:${error2.error}`] });
        
        // Override the second event with a new one
        eventEmitter.emit('error', error3);
        expect(listener1).toHaveBeenCalledTimes(3);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error3.name, message: [`notifications:${error3.name}`, `notifications:${error3.error}`] });
    });

    test('progress notification', () => {
        const simpleProgress = { name: 'foo', progress: 0.1 };
        const progressWithCustomText = { name: 'bar', customText: 'Custom message', progress: 0.3 };
        const doneProgress = { name: 'bar', progress: 1.0 };
        const doneProgressWithCustomText = { name: 'bar', customText: 'Custom message', progress: 1.0 };

        // Emit a first event
        eventEmitter.emit('progress', simpleProgress);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: simpleProgress.name, message: [`notifications:${simpleProgress.name}`, `10%`], done: false });
        
        // Emit a second event with custom text
        eventEmitter.emit('progress', progressWithCustomText);
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: progressWithCustomText.name, message: [`notifications:${progressWithCustomText.name}`, `${progressWithCustomText.customText}`], done: false });
        
        // Add a second event with progress done
        eventEmitter.emit('progress', doneProgress);
        expect(listener1).toHaveBeenCalledTimes(3);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: doneProgress.name, message: [`notifications:${doneProgress.name}`, `100%`], done: true });

        // Add a second event with progress done and custom text
        eventEmitter.emit('progress', doneProgressWithCustomText);
        expect(listener1).toHaveBeenCalledTimes(4);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: doneProgress.name, message: [`notifications:${doneProgress.name}`, `${doneProgressWithCustomText.customText}`], done: true });

    });

    test('progress count notification', () => {
        const simpleProgress = { name: 'foo', progress: 50 };
        const progressWithCustomText = { name: 'bar', customText: 'Custom message', progress: 80 };
        const doneProgress = { name: 'bar', progress: -1 };
        const doneProgressWithCustomText = { name: 'bar', customText: 'Custom message', progress: -1 };

        // Emit a first event
        eventEmitter.emit('progressCount', simpleProgress);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: simpleProgress.name, message: [`notifications:${simpleProgress.name}`, `${simpleProgress.progress}`], done: false });
        
        // Emit a second event with custom text
        eventEmitter.emit('progressCount', progressWithCustomText);
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: progressWithCustomText.name, message: [`notifications:${progressWithCustomText.name}`, `${progressWithCustomText.customText}`], done: false });
        
        // Add a second event with progress done
        eventEmitter.emit('progressCount', doneProgress);
        expect(listener1).toHaveBeenCalledTimes(3);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: doneProgress.name, message: [`notifications:${doneProgress.name}`, `${doneProgress.progress}`], done: true });

        // Add a second event with progress done and custom text
        eventEmitter.emit('progressCount', doneProgressWithCustomText);
        expect(listener1).toHaveBeenCalledTimes(4);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: doneProgress.name, message: [`notifications:${doneProgress.name}`, `${doneProgressWithCustomText.customText}`], done: true });

    });

});

each([
    ['socketEventManager', serviceLocator.socketEventManager],
    ['eventManager', serviceLocator.eventManager]
]).describe('Multiple listeners', (_name, eventEmitter) => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    notificationService.addListener(listener1);
    notificationService.addListener(listener2);

    beforeEach(() => {
        listener1.mockClear();
        listener2.mockClear();
    })
    
    test('error notification', () => {
        const error = { name: 'foo', error: 'there was an error' };
        const error2 = { name: 'bar', error: 'there was an error' };
        const error3 = { name: 'bar', error: 'This is a new error' };

        // Emit a first event
        eventEmitter.emit('error', error);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error.name, message: [`notifications:${error.name}`, `notifications:${error.error}`] });
        expect(listener2).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenLastCalledWith({ type: 'error', name: error.name, message: [`notifications:${error.name}`, `notifications:${error.error}`] });

        // Emit a second event
        eventEmitter.emit('error', error2);
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error2.name, message: [`notifications:${error2.name}`, `notifications:${error2.error}`] });
        expect(listener2).toHaveBeenCalledTimes(2);
        expect(listener2).toHaveBeenLastCalledWith({ type: 'error', name: error2.name, message: [`notifications:${error2.name}`, `notifications:${error2.error}`] });

        // Override the second event with a new one
        eventEmitter.emit('error', error3);
        expect(listener1).toHaveBeenCalledTimes(3);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error3.name, message: [`notifications:${error3.name}`, `notifications:${error3.error}`] });
        expect(listener2).toHaveBeenCalledTimes(3);
        expect(listener2).toHaveBeenLastCalledWith({ type: 'error', name: error3.name, message: [`notifications:${error3.name}`, `notifications:${error3.error}`] });

    });

    test('Remove listeners', () => {
        const error = { name: 'foo', error: 'there was an error' };
        notificationService.removeListener(listener2);

        // Emit a first event
        eventEmitter.emit('error', error);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(0);

        // Remove second listener and emit an even
        notificationService.removeListener(listener1);
        eventEmitter.emit('error', error);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(0);
        
        // Add the listeners again and emit a new event
        notificationService.addListener(listener2);
        notificationService.addListener(listener1);
        eventEmitter.emit('error', error);
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener2).toHaveBeenCalledTimes(1);

    })
});

describe('Emit on custom emitter', () => {
    const listener1 = jest.fn();
    notificationService.addListener(listener1);

    const eventEmitter = new EventEmitter();
    notificationService.registerEventsOnEmitter(eventEmitter);

    beforeEach(() => {
        listener1.mockClear();
    })
    
    test('error notification', () => {
        const error = { name: 'foo', error: 'there was an error' };
        const error2 = { name: 'bar', error: 'there was an error' };
        const error3 = { name: 'bar', error: 'This is a new error' };

        // Emit a first event
        eventEmitter.emit('error', error);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error.name, message: [`notifications:${error.name}`, `notifications:${error.error}`] });
        
        // Emit a second event
        eventEmitter.emit('error', error2);
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error2.name, message: [`notifications:${error2.name}`, `notifications:${error2.error}`] });
        
        // Override the second event with a new one
        eventEmitter.emit('error', error3);
        expect(listener1).toHaveBeenCalledTimes(3);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'error', name: error3.name, message: [`notifications:${error3.name}`, `notifications:${error3.error}`] });
    });

    test('progress notification', () => {
        const simpleProgress = { name: 'foo', progress: 0.1 };
        const progressWithCustomText = { name: 'bar', customText: 'Custom message', progress: 0.3 };
        const doneProgress = { name: 'bar', progress: 1.0 };
        const doneProgressWithCustomText = { name: 'bar', customText: 'Custom message', progress: 1.0 };

        // Emit a first event
        eventEmitter.emit('progress', simpleProgress);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: simpleProgress.name, message: [`notifications:${simpleProgress.name}`, `10%`], done: false });
        
        // Emit a second event with custom text
        eventEmitter.emit('progress', progressWithCustomText);
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: progressWithCustomText.name, message: [`notifications:${progressWithCustomText.name}`, `${progressWithCustomText.customText}`], done: false });
        
        // Add a second event with progress done
        eventEmitter.emit('progress', doneProgress);
        expect(listener1).toHaveBeenCalledTimes(3);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: doneProgress.name, message: [`notifications:${doneProgress.name}`, `100%`], done: true });

        // Add a second event with progress done and custom text
        eventEmitter.emit('progress', doneProgressWithCustomText);
        expect(listener1).toHaveBeenCalledTimes(4);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: doneProgress.name, message: [`notifications:${doneProgress.name}`, `${doneProgressWithCustomText.customText}`], done: true });

    });

    test('progress count notification', () => {
        const simpleProgress = { name: 'foo', progress: 50 };
        const progressWithCustomText = { name: 'bar', customText: 'Custom message', progress: 80 };
        const doneProgress = { name: 'bar', progress: -1 };
        const doneProgressWithCustomText = { name: 'bar', customText: 'Custom message', progress: -1 };

        // Emit a first event
        eventEmitter.emit('progressCount', simpleProgress);
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: simpleProgress.name, message: [`notifications:${simpleProgress.name}`, `${simpleProgress.progress}`], done: false });
        
        // Emit a second event with custom text
        eventEmitter.emit('progressCount', progressWithCustomText);
        expect(listener1).toHaveBeenCalledTimes(2);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: progressWithCustomText.name, message: [`notifications:${progressWithCustomText.name}`, `${progressWithCustomText.customText}`], done: false });
        
        // Add a second event with progress done
        eventEmitter.emit('progressCount', doneProgress);
        expect(listener1).toHaveBeenCalledTimes(3);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: doneProgress.name, message: [`notifications:${doneProgress.name}`, `${doneProgress.progress}`], done: true });

        // Add a second event with progress done and custom text
        eventEmitter.emit('progressCount', doneProgressWithCustomText);
        expect(listener1).toHaveBeenCalledTimes(4);
        expect(listener1).toHaveBeenLastCalledWith({ type: 'progress', name: doneProgress.name, message: [`notifications:${doneProgress.name}`, `${doneProgressWithCustomText.customText}`], done: true });

    });

});