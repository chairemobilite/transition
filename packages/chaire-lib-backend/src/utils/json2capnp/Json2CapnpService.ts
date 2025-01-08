/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import url from 'url';
// TODO replace this fetch-retry library with one compatible with TS
/* eslint-disable-next-line */
const fetchRetry = require('@zeit/fetch-retry')(require('node-fetch'));

// Only do 4 retries instead of the default 5, as the retry period increases at
// each tentative. The default causes a too long wait period.
const fetch = async (url: string, opts) => {
    return await fetchRetry(url, Object.assign({ retry: { retries: 4 }, ...opts }));
};

import Preferences from 'chaire-lib-common/lib/config/Preferences';

class Json2CapnpService {
    // TODO Support the cache path directory or remove from method
    async writeCache(cacheName: string, jsonData: any, _cachePathDirectory?: string) {
        try {
            const request = `${this.getUrlPrefix()}${cacheName}`;
            const response = await fetch(request, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(jsonData)
            });
            return await response.json();
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async readCache(cacheName: string, params = {}) {
        try {
            const query = new url.URLSearchParams();
            for (const param in params) {
                query.append(param, params[param]);
            }
            const request = `${this.getUrlPrefix()}${cacheName}?${query.toString()}`;

            const response = await fetch(request, {
                method: 'GET'
            });
            return await response.json();
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
