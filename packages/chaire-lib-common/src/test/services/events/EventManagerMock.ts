/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import EventManagerImpl, { EventManager } from '../../../services/events/EventManager';
import serviceLocator from '../../../utils/ServiceLocator';

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const eventMngr = new EventManagerImpl();

const mockEmit: jest.MockedFunction<(event: string | Event, ...args: any[]) => void> = jest.fn();
mockEmit.mockImplementation((_event, ...args) => {
    if (args.length > 0 && typeof args[args.length - 1] === 'function') {
        const result = responses.splice(0, 1);
        args[args.length - 1](result.length > 0 ? result[0] : {});
    } else {
        return responses.splice(0, 1);
    }
});

const mockEmitProgress: jest.MockedFunction<(progressName: string, completeRatio: number) => void> = jest.fn();
const mockEmitEvent: jest.MockedFunction<typeof eventMngr.emitEvent> = jest.fn();

const responses: any[] = [];

const eventManagerMock = {
    emit: mockEmit,
    emitProgress: mockEmitProgress,
    emitEvent: mockEmitEvent,
    onEvent: jest.fn(),
    once: jest.fn(),
    on: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    off: jest.fn()
} as EventManager;

const enableMocks = () => {
    jest.mock('../../../../lib/services/events/EventManager', () => {
        return () => eventManagerMock;
    });
    // Replace the service locator's event manager by the mock
    serviceLocator.addService('eventManager', eventManagerMock);
    serviceLocator.addService('socketEventManager', eventManagerMock);
};

const mockClear = () => {
    mockEmit.mockClear();
    mockEmitProgress.mockClear();
};

const emitResponseReturnOnce = (response: any) => {
    responses.push(response);
};

export default {
    enableMocks,
    mockClear,
    eventManagerMock,
    emitResponseReturnOnce
};
