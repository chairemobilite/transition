/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { RoutingService } from './RoutingService';
import ManualRoutingService from './ManualRoutingService';
import OSRMRoutingService from './OSRMRoutingService';
import ValhallaRoutingService from './ValhallaRoutingService';

export const DEFAULT_ROUTING_ENGINE = 'osrm';
export interface RoutingServiceManager {
    getRoutingServiceForEngine: (engine: string) => RoutingService;
}

/**
 * This class manages the various routing services and engines for the application
 */
class RoutingServiceManagerImpl implements RoutingServiceManager {
    private _defaultService: RoutingService;
    private _routingServices: { [key: string]: RoutingService };

    constructor() {
        // FIXME Do not configure in this class, as some apps could add engines,
        // use different services for same engine, etc
        this._defaultService = new ManualRoutingService();
        const osrmService = new OSRMRoutingService();
        const valhallaService = new ValhallaRoutingService();
        this._routingServices = {
            manual: this._defaultService,
            osrm: osrmService,
            valhalla: valhallaService,
            engineCustom: osrmService
        };
    }

    public getRoutingServiceForEngine = (engine?: string): RoutingService => {
        const service = engine ? this._routingServices[engine] : undefined;
        return service ? service : this._defaultService;
    };
}

const routingServiceManager = new RoutingServiceManagerImpl();
export default routingServiceManager;
