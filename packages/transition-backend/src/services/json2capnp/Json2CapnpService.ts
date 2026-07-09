/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import url from 'url';
import fetchRetryFactory from 'fetch-retry';
const fetchWithRetry = fetchRetryFactory(global.fetch);

// Only do 4 retries instead of the default 5, as the retry period increases at
// each tentative. The default causes a too long wait period.
const fetch = async (url: string, opts) => {
    return await fetchWithRetry(url, { retries: 4, ...opts });
};

import Preferences from 'chaire-lib-common/lib/config/Preferences';

// To get default path
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import config from 'chaire-lib-backend/lib/config/server.config';

import { capnp_serialization } from 'transition-rust-backend';

class Json2CapnpService {
    // TODO Support the cache path directory or remove from method
    async writeCache(cacheName: string, jsonData: any, cachePathDirectoryArg?: string) {
        try {
            // Default path copied path from TrRoutingProcessManager
            // TODO Put this into a fonction of directory manager or config
            const cachePathDirectory =
                cachePathDirectoryArg ?? `${directoryManager.projectDirectory}/cache/${config.projectShortname}`;

            if (cacheName === 'agencies') {
                return await capnp_serialization.writeAgencyCollection(
                    cachePathDirectory + '/agencies.capnpbin',
                    JSON.stringify(jsonData)
                );
            } else if (cacheName === 'lines') {
                return await capnp_serialization.writeLineCollection(
                    cachePathDirectory + '/lines.capnpbin',
                    JSON.stringify(jsonData)
                );
            } else if (cacheName === 'paths') {
                return await capnp_serialization.writePathCollection(
                    cachePathDirectory + '/paths.capnpbin',
                    JSON.stringify(jsonData)
                );
            } else if (cacheName === 'nodes') {
                return await capnp_serialization.writeNodeCollection(
                    cachePathDirectory + '/nodes.capnpbin',
                    JSON.stringify(jsonData)
                );
            } else if (cacheName === 'scenarios') {
                return await capnp_serialization.writeScenarioCollection(
                    cachePathDirectory + '/scenarios.capnpbin',
                    JSON.stringify(jsonData)
                );
            } else if (cacheName === 'services') {
                return await capnp_serialization.writeServiceCollection(
                    cachePathDirectory + '/services.capnpbin',
                    JSON.stringify(jsonData)
                );
            } else if (cacheName === 'line') {
                return await capnp_serialization.writeLineObject(
                    cachePathDirectory + '/lines',
                    JSON.stringify(jsonData)
                );
            } else if (cacheName === 'node') {
                return await capnp_serialization.writeNodeObject(
                    cachePathDirectory + '/nodes',
                    JSON.stringify(jsonData)
                );
            } else {
                console.warn(`Using legacy capnp write for ${cacheName}`);
                const request = `${this.getUrlPrefix()}${cacheName}`;
                const response = await fetch(request, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(jsonData)
                });
                return await response.json();
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async readCache(cacheName: string, params = {}) {
        try {
            // TODO Use the path coming from the parameters instead of always the default one.
            // TODO (It has no impact now, as the function is not used, but need to be done if
            // TODO somebody want to start using it.)
            // Copied path from TrRoutingProcessManager
            const cachePathDirectory = `${directoryManager.projectDirectory}/cache/${config.projectShortname}`;
            let rustResult = {};
            if (cacheName === 'agencies') {
                rustResult = JSON.parse(
                    await capnp_serialization.readAgencyCollection(cachePathDirectory + '/agencies.capnpbin')
                );
            } else if (cacheName === 'lines') {
                rustResult = JSON.parse(
                    await capnp_serialization.readLineCollection(cachePathDirectory + '/lines.capnpbin')
                );
            } else if (cacheName === 'paths') {
                rustResult = JSON.parse(
                    await capnp_serialization.readPathCollection(cachePathDirectory + '/paths.capnpbin')
                );
            } else if (cacheName === 'nodes') {
                rustResult = JSON.parse(
                    await capnp_serialization.readNodeCollection(cachePathDirectory + '/nodes.capnpbin')
                );
            } else if (cacheName === 'scenarios') {
                rustResult = JSON.parse(
                    await capnp_serialization.readScenarioCollection(cachePathDirectory + '/scenarios.capnpbin')
                );
            } else if (cacheName === 'services') {
                rustResult = JSON.parse(
                    await capnp_serialization.readServiceCollection(cachePathDirectory + '/services.capnpbin')
                );
            } else if (cacheName === 'line') {
                // TODO We need to properly type the params object to insure that the uuid is always available
                rustResult = JSON.parse(
                    await capnp_serialization.readLineObject(params['uuid'], cachePathDirectory + '/lines')
                );
            } else if (cacheName === 'node') {
                rustResult = JSON.parse(
                    await capnp_serialization.readNodeObject(params['uuid'], cachePathDirectory + '/nodes')
                );
            } else {
                console.warn(`Using legacy capnp read for ${cacheName}`);

                const query = new url.URLSearchParams();
                for (const param in params) {
                    query.append(param, params[param]);
                }
                const request = `${this.getUrlPrefix()}${cacheName}?${query.toString()}`;

                const response = await fetch(request, {
                    method: 'GET'
                });

                return await response.json();
            }

            // Package result from rust direct call into same structure than legacy Json2Capnp
            return { cacheName: cacheName, status: 'success', data: rustResult };
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    getUrlPrefix(host?: string, port?: string) {
        const json2CapnpConfig = Preferences.get('json2Capnp', {});
        if (host === undefined || host === null || host === '') {
            host = json2CapnpConfig.host || 'http://localhost';
        }
        if (port === undefined || port === null || port === '') {
            port = json2CapnpConfig.port;
        }
        return `${host}${port ? ':' + port : ''}/`;
    }
}

const instance = new Json2CapnpService();
Object.freeze(instance);

export default instance;
