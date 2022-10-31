/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { default as RoutingUtilsMock } from './services/routing/RoutingUtilsMock';
import { default as TrRoutingServiceMock } from './services/trRouting/TrRoutingServiceMock';
import { default as RoutingServiceManagerMock } from './services/routing/RoutingServiceManagerMock';
import { default as EventManagerMock } from './services/events/EventManagerMock';

/**
 * Enable all mocks from the chaire-lib module. Can be called from a jest setup
 * file at the root of a package, the functionalities will automatically be
 * mocked.
 */
export const enableAllMocks = () => {
    RoutingUtilsMock.enableMocks();
    TrRoutingServiceMock.enableMocks();
    RoutingServiceManagerMock.enableMocks();
    EventManagerMock.enableMocks();
};

export { default as TestUtils } from './TestUtils';
export { default as RoutingServiceManagerMock } from './services/routing/RoutingServiceManagerMock';
export { default as EventManagerMock } from './services/events/EventManagerMock';
