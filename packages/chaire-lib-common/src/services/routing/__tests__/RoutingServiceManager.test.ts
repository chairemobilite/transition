/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import routingServiceManager from '../RoutingServiceManager';

test('Service Manager for Engines', () => {
    // Cannot type check, so checking with what is expected to be the default
    const baseRoutingService = routingServiceManager.getRoutingServiceForEngine('manual');
    let routingService = routingServiceManager.getRoutingServiceForEngine('engine');
    expect(routingService).not.toBe(baseRoutingService);
    routingService = routingServiceManager.getRoutingServiceForEngine('engineCustom');
    expect(routingService).not.toBe(baseRoutingService);
});

test('Service Manager Default Engine', () => {
    // Cannot type check, so checking with what is expected to be the default
    const defaultRoutingService = routingServiceManager.getRoutingServiceForEngine('manual');
    // Empty string should return the default
    let routingService = routingServiceManager.getRoutingServiceForEngine('');
    expect(routingService).toBe(defaultRoutingService);
    // Unknown engine should return the default
    routingService = routingServiceManager.getRoutingServiceForEngine('not an engine');
    expect(routingService).toBe(defaultRoutingService);
    // Undefined should return the default
    routingService = routingServiceManager.getRoutingServiceForEngine();
    expect(routingService).toBe(defaultRoutingService);
});
