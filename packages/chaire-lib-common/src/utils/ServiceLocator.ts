/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export interface ServiceLocator {
    addService(serviceName: string, serviceInstance: any): void;
    removeService(serviceName: string): void;
    hasService(serviceName: string): boolean;
    [key: string]: any;
}

class ServiceLocatorImpl implements ServiceLocator {
    private _services: any;
    // TODO Name the actual available services instead of this arbitrary and type them
    [key: string]: any;

    constructor() {
        this._services = {};
    }

    addService(serviceName, serviceInstance) {
        this._services[serviceName] = serviceInstance;
        this[serviceName] = this._services[serviceName];
    }

    removeService(serviceName) {
        delete this._services[serviceName];
        delete this[serviceName];
    }

    hasService(serviceName) {
        return this._services[serviceName] !== undefined && this[serviceName] !== undefined;
    }

    serviceNames() {
        return Object.keys(this._services);
    }
}

// singleton:
const instance = new ServiceLocatorImpl();
export default instance;
