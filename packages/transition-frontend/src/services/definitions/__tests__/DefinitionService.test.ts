/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import { getDefinitionFromServer } from '../DefinitionsService';

const eventEmitter = new EventEmitter();
serviceLocator.socketEventManager = eventEmitter;
const defaultResponse = { en: 'english def', fr: 'french def'};
const mockGetDefinitionSocketRoute = jest.fn().mockImplementation((label, callback) => {
    callback(Status.createOk(defaultResponse));
});
eventEmitter.on('service.getOneDefinition', mockGetDefinitionSocketRoute);

beforeEach(() => {
    jest.clearAllMocks();
});

describe('getDefinitionFromServer', () => {

    const mockSetDefinition = jest.fn();
    const mockSetGotError = jest.fn();

    // Since labels are cached, we need to append a number to the label to make sure we are testing different labels
    let testNumber = 0;
    let label = `label ${testNumber}`;
    beforeEach(() => {
        testNumber++;
        label = `label ${testNumber}`;
    });

    // Create a promise that will be resolved when the function is called
    const getPromiseForFunction = (mockFn) => {
        let resolvePromise;
        const promiseToWaitFor = new Promise((resolve) => {
            resolvePromise = resolve;
        });
        mockFn.mockImplementationOnce(() => resolvePromise());
        return promiseToWaitFor;
    }


    test('should call the socket route if the cache is not set and set the definition after', async () => {
        // Create a promise that will be resolved when the get definition is set
        const definitionPromise = getPromiseForFunction(mockSetDefinition);

        // Call the function to test and wait for the promise to resolve
        getDefinitionFromServer(label, mockSetDefinition, mockSetGotError);
        await definitionPromise;

        // Validate calls
        expect(mockSetDefinition).toHaveBeenCalledWith(defaultResponse);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledTimes(1);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledWith(label, expect.any(Function));
        expect(mockSetGotError).toHaveBeenCalledWith(false);

    });

    test('should call the socket route if the cache is not set and set an error if the route returns error', async () => {
        
        // Create a promise that will be resolved when the get error is set
        const getErrorPromise = getPromiseForFunction(mockSetGotError);

        // Return an error from the server
        mockGetDefinitionSocketRoute.mockImplementationOnce((label, callback) => {
            callback(Status.createError('error'));
        });

        // Call the function to test and wait for the promise to resolve
        getDefinitionFromServer(label, mockSetDefinition, mockSetGotError);
        await getErrorPromise;

        // Validate calls
        expect(mockSetGotError).toHaveBeenCalledWith(true);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledTimes(1);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledWith(label, expect.any(Function));
        expect(mockSetDefinition).not.toHaveBeenCalled();

    });

    test('should call the socket route again if previous had an error', async () => {

        // Create promises that will be resolved when the their respective function is called
        const getErrorPromise = getPromiseForFunction(mockSetGotError);
        const definitionPromise = getPromiseForFunction(mockSetDefinition);

        // Return an error from the server for the first call
        mockGetDefinitionSocketRoute.mockImplementationOnce((label, callback) => {
            callback(Status.createError('error'));
        });

        // Call the function to test and wait for the promise to resolve
        getDefinitionFromServer(label, mockSetDefinition, mockSetGotError);
        await getErrorPromise;

        // Call the function again, the socket route should be called again
        getDefinitionFromServer(label, mockSetDefinition, mockSetGotError);
        await definitionPromise;

        // Validate calls
        expect(mockSetDefinition).toHaveBeenCalledWith(defaultResponse);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledTimes(2);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledWith(label, expect.any(Function));

        // The error should have been called twice, with true and false
        expect(mockSetGotError).toHaveBeenNthCalledWith(1, true);
        expect(mockSetGotError).toHaveBeenNthCalledWith(2, false);
    });

    test('should return the definition from the cache if it is already loaded', async () => {
        // Create promises that will be resolved when the their respective function is called
        const definitionPromise1 = getPromiseForFunction(mockSetDefinition);
        const definitionPromise2 = getPromiseForFunction(mockSetDefinition);

        // Call the function to test and wait for the promise to resolve
        getDefinitionFromServer(label, mockSetDefinition, mockSetGotError);
        await definitionPromise1;

        // Call the definition a second time, the definition should be returned from the cache
        getDefinitionFromServer(label, mockSetDefinition, mockSetGotError);
        await definitionPromise2;

        // Validate calls, setDefinition should have been called twice, but the socket route, only once
        expect(mockSetDefinition).toHaveBeenCalledTimes(2);
        expect(mockSetDefinition).toHaveBeenNthCalledWith(1, defaultResponse);
        expect(mockSetDefinition).toHaveBeenNthCalledWith(2, defaultResponse);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledTimes(1);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledWith(label, expect.any(Function));
    });

    test('should wait for loading to complete if definition is being loaded', async () => {
        // Create promises that will be resolved when the their respective function is called
        const definitionPromise1 = getPromiseForFunction(mockSetDefinition);
        const definitionPromise2 = getPromiseForFunction(mockSetDefinition);

        // Mock the socket route implementation such that we can control when it
        // returns, the resolveServerSidePromise will be used to resolve the
        // promise and trigger the callback
        let resolveServerSidePromise;
        const serverSidePromise = new Promise((resolve) => {
            resolveServerSidePromise = resolve;
        });
        mockGetDefinitionSocketRoute.mockImplementationOnce((label, callback) => {
            serverSidePromise.then(() => {
                callback(Status.createOk(defaultResponse));
            });
        });

        // Call the function a first time, which should call the server
        getDefinitionFromServer(label, mockSetDefinition, mockSetGotError);

        // Call the definition a second time, which should wait for the first to complete
        getDefinitionFromServer(label, mockSetDefinition, mockSetGotError);

        // At this point, the setDefinition function should not have been called
        expect(mockSetDefinition).not.toHaveBeenCalled();

        // resolve the server promise to trigger the callback
        resolveServerSidePromise();
        await definitionPromise1;
        await definitionPromise2;

        // Validate calls, setDefinition should have been called twice, but the socket route, only once
        expect(mockSetDefinition).toHaveBeenCalledTimes(2);
        expect(mockSetDefinition).toHaveBeenNthCalledWith(1, defaultResponse);
        expect(mockSetDefinition).toHaveBeenNthCalledWith(2, defaultResponse);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledTimes(1);
        expect(mockGetDefinitionSocketRoute).toHaveBeenCalledWith(label, expect.any(Function));
    });

});

