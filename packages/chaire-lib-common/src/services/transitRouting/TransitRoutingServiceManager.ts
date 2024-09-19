/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TrRoutingService } from './TransitRoutingService';

/**
 * This class manages the various routing services and engines for the application
 */
class TrRoutingServiceManagerImpl {
    private _service: TrRoutingService;

    constructor() {
        // FIXME Do not configure in this class, as some apps could add engines,
        // use different services for same engine, etc
        this._service = new TrRoutingService();
    }

    public getService = (): TrRoutingService => {
        return this._service;
    };
}

export const routingServiceManager = new TrRoutingServiceManagerImpl();
