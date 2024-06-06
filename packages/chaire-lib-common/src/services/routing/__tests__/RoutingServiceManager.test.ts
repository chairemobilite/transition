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
    const baseRoutingService = routingServiceManager.getRoutingServiceForEngine('manual');
    let routingService = routingServiceManager.getRoutingServiceForEngine('');
    expect(routingService).toBe(baseRoutingService);
    routingService = routingServiceManager.getRoutingServiceForEngine('not an engine');
    expect(routingService).toBe(baseRoutingService);
});

test('Service Manager for array of engines', () => {
    // Cannot type check, so checking with what is expected
    const manualRoutingService = routingServiceManager.getRoutingServiceForEngine('manual');
    const engineRoutingService = routingServiceManager.getRoutingServiceForEngine('engine');

    // Test with manual engine first
    const manualFirstService = routingServiceManager.getRoutingServiceForEngine(['manual', 'engine']);
    expect(manualFirstService).toBe(manualRoutingService);
    // Test with engine first
    const engineFirstService = routingServiceManager.getRoutingServiceForEngine(['engine', 'manual']);
    expect(engineFirstService).toBe(engineRoutingService);
    // Test with unknown engines, should fallback to manual
    const unknownEnginesService = routingServiceManager.getRoutingServiceForEngine(['not an engine', 'other']);
    expect(unknownEnginesService).toBe(manualRoutingService);
    // Test with unknown engines and 'engine', should find first available
    const someUnknownService = routingServiceManager.getRoutingServiceForEngine(['not an engine', 'engine']);
    expect(someUnknownService).toBe(engineRoutingService);
});