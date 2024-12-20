/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _merge from 'lodash/merge';
import _camelCase from 'lodash/camelCase';
import _flatten from 'lodash/flatten';

import GeoJSON from 'geojson';
import osrm from 'osrm'; // Types from the osrm API definition see https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/osrm/index.d.ts

import * as RoutingService from 'chaire-lib-common/lib/services/routing/RoutingService';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { TransitionRouteOptions, TransitionMatchOptions } from 'chaire-lib-common/lib/api/OSRMRouting';

//TODO replace this fetch-retry library with one compatible with TS
/* eslint-disable-next-line */
const fetch = require('@zeit/fetch-retry')(require('node-fetch'));

type OSRMServiceTypes = 'route' | 'nearest' | 'table' | 'match' | 'trip' | 'tile';

type OSRMOptions = osrm.MatchOptions | osrm.RouteOptions | osrm.TableOptions;

/*
Represent a configured routing mode for OSRM.

API is defined in http://project-osrm.org/docs/v5.24.0/api/
(Double check the OSRM version in the documentation)
*/
class OSRMMode {
    // TODO Is _mode should be a " { RoutingMode } from '../config/routingModes';" instead of a string?
    private _mode: string;
    private _host: string;
    private _port: number;
    private _isSecure: boolean;

    constructor(mode: string, host: string, port: number, isSecure = false) {
        if (mode === '') {
            throw new Error('OSRMMode: invalid empty mode');
        } else {
            this._mode = mode;
        }
        if (host === '') {
            // Assume localhost if host is empty
            this._host = 'localhost';
        } else {
            this._host = host;
        }

        // TODO DO we allow port to be NULL and this not add it to the URL ?
        if (port > 0) {
            this._port = port;
        } else {
            throw new Error('OSRMMode: port number must be valid');
        }

        this._isSecure = isSecure;
    }

    private validateParamMode(mode: string) {
        //Assert params.mode == this._mode or params.mode is undefined
        if (mode !== this._mode || mode === '') {
            //TODO Can we set better type for the exception
            throw Error(`OSRMMode: Calling function with wrong mode ${mode} ${this._mode}`);
        }
    }

    public async route(params: TransitionRouteOptions): Promise<Status.Status<osrm.RouteResults>> {
        this.validateParamMode(params.mode);
        //TODO validate that points is not empty?? Does it make sense ?

        // Fill in default values if they are not defined
        const parameters = _merge(
            {
                alternatives: params?.withAlternatives === true ? true : false,
                steps: false,
                annotations: false, // use "nodes" to get all osm nodes ids
                geometries: 'geojson',
                overview: 'full',
                continue_straight: 'default'
            },
            params
        );

        const optionKeys = ['alternatives', 'steps', 'annotations', 'continue_straight', 'geometries', 'overview'];

        const routeQuery = this.buildOsrmQuery('route', params.points, optionKeys, parameters);

        const response = await fetch(routeQuery);

        const routingResultJson = await response.json();

        //TODO Validate that this is used somewhere. Not part of the object definition
        routingResultJson.query = routeQuery;

        // Process result if OSRM returned a valid response
        if (response.ok) {
            return Status.createOk(routingResultJson);
        } else {
            return Status.createError(routingResultJson);
        }
    }

    public async match(params: TransitionMatchOptions): Promise<Status.Status<osrm.MatchResults>> {
        this.validateParamMode(params.mode);

        //TODO validate that points is not empty?? Does it make sense ?

        //TODO Maybe default values should be handled by a params object directly?
        // Fill in default values if they are not defined
        const parameters = _merge(
            {
                radiuses: [],
                timestamps: [],
                alternatives: false,
                steps: true,
                annotations: false,
                gaps: 'ignore',
                geometries: 'geojson',
                overview: 'full',
                toto: 'oui'
            },
            params
        );

        const optionKeys = ['radiuses', 'timestamps', 'steps', 'annotations', 'gaps', 'geometries', 'overview'];

        const matchQuery = this.buildOsrmQuery('match', params.points, optionKeys, parameters);

        const response = await fetch(matchQuery);

        const routingResultJson = await response.json();

        //TODO Validate that this is used somewhere. Not part of the object definition
        routingResultJson.query = matchQuery;

        // Process result if OSRM returned a valid response
        if (response.ok) {
            return Status.createOk(routingResultJson);
        } else {
            return Status.createError(routingResultJson);
        }
    }

    public async tableFrom(
        params: RoutingService.TableFromParameters
    ): Promise<Status.Status<RoutingService.TableResults>> {
        this.validateParamMode(params.mode);

        // Validate paremeters
        //TODO Check Source length = 1 and destinations > 0

        const optionKeys = ['sources', 'annotations'];

        const options = {
            sources: [0],
            annotations: ['duration', 'distance'] as ('duration' | 'distance')[]
        };

        // Add origin as the first element of the feature list
        // Copy the array with slice (will keep reference to the same internal objects)
        const features = params.destinations.slice();
        // Prepend the origin
        features.unshift(params.origin);

        const tableFromQuery = this.buildOsrmQuery('table', features, optionKeys, options);

        const response = await fetch(tableFromQuery);

        const routingResultJson = await response.json();

        // Process result if OSRM returned a valid response
        if (response.ok) {
            let durations = [];
            let distances = [];

            // Durations and distances results are in this form: [[0,0,0,235.1,438.6]]
            // Check that we have at least one result in the inner array, otherwise return empty arrays
            if (
                routingResultJson.durations &&
                routingResultJson.durations[0] &&
                routingResultJson.distances &&
                routingResultJson.distances[0]
            ) {
                durations = routingResultJson.durations[0].slice(1); // remove origin to itself
                distances = routingResultJson.distances[0].slice(1); // remove origin to itself
            }

            const result: RoutingService.TableResults = {
                query: tableFromQuery,
                durations: durations,
                distances: distances
            };

            return Status.createOk(result);
        } else {
            return Status.createError(routingResultJson);
        }
    }

    //TODO tableTo need some integration testing, only validated with unit tests
    public async tableTo(
        params: RoutingService.TableToParameters
    ): Promise<Status.Status<RoutingService.TableResults>> {
        this.validateParamMode(params.mode);

        // Validate paremeters
        //TODO Check Sources length > 0 and destination == 1

        const optionKeys = ['destinations', 'annotations'];

        const options = {
            destinations: [0],
            annotations: ['duration', 'distance'] as ('duration' | 'distance')[]
        };

        // Add destination as the first element of the feature list
        // Copy the array with slice (will keep reference to the same internal objects)
        const features = params.origins.slice();
        // Prepend the origin
        features.unshift(params.destination);

        const tableToQuery = this.buildOsrmQuery('table', features, optionKeys, options);

        const response = await fetch(tableToQuery);

        const routingResultJson = await response.json();

        // Process result if OSRM returned a valid response
        if (response.ok) {
            let durations: number[] = [];
            let distances: number[] = [];
            //TODO This is slightly different than the old code, need to confirm it works
            // Durations and distance are in this form: [[0],[0],[0],[235.1],[438.6]]
            // Check that we have at least one result, otherwise return empty arrays
            if (
                routingResultJson.durations &&
                routingResultJson.durations.length > 1 &&
                routingResultJson.distances &&
                routingResultJson.distances.length > 1
            ) {
                durations = _flatten(routingResultJson.durations as number[][]).slice(1); // remove destination to itself
                distances = _flatten(routingResultJson.distances as number[][]).slice(1); // remove destination to itself
            }

            const result: RoutingService.TableResults = {
                query: tableToQuery,
                durations: durations,
                distances: distances
            };

            return Status.createOk(result);
        } else {
            return Status.createError(routingResultJson);
        }
    }

    // TODO Should drop the optionsKeys and just send all not undefined values, since we use a proper options object now
    private buildOsrmQuery(
        service: OSRMServiceTypes,
        features: GeoJSON.Feature<GeoJSON.Point>[],
        optionsKeys: string[],
        params: OSRMOptions
    ): string {
        // Build the http://host:port/ part
        const prefix = this.buildUrlPrefix();

        // Protocol is always v1 for now
        const protocol = 'v1';

        // profile is unused, but it still want a valid string there, so we camelcase the mode string
        const profile = _camelCase(this._mode);

        const coordinates = this.buildCoordinatesQuery(features);

        const options = this.buildOptionsQuery(optionsKeys, params);

        // We don't set the format param, since it's optional and always json
        const fullQuery = `${prefix}${service}/${protocol}/${profile}/${coordinates}?${options}`;

        return fullQuery;
    }

    private buildOptionsQuery(keys: string[], options: OSRMOptions): string {
        const optionsArray: string[] = [];

        keys.forEach((key) => {
            const option = options[key];

            if (option !== undefined) {
                let optionStr;
                if (Array.isArray(option)) {
                    // Annotations is an exception and need a ',' as separator
                    if (key === 'annotations') {
                        optionStr = option.join(',');
                    } else {
                        optionStr = option.join(';');
                    }
                } else {
                    optionStr = String(option);
                }
                optionsArray.push(key + '=' + optionStr);
            }
        });
        // Join each option with the & symbol
        return optionsArray.join('&');
    }

    private buildCoordinatesQuery(features: GeoJSON.Feature<GeoJSON.Point>[]): string {
        const coordinates: string[] = [];
        for (let i = 0, count = features.length; i < count; i++) {
            if (features[i].geometry) {
                // FIXME: This validation and message is for debugging purposes, remove when fixed
                if (!features[i].geometry.coordinates) {
                    console.error('Unexpected geometry', features[i].geometry.coordinates);
                    throw Error('Unexpected geometry');
                } else {
                    coordinates.push(features[i].geometry.coordinates.join(','));
                }
            }
        }
        return coordinates.join(';');
    }

    /* Return the protocol-host-port part of the URI */
    private buildUrlPrefix(): string {
        const protocol = 'http' + (this._isSecure ? 's' : '');
        const portStr = ':' + this._port.toString();

        const prefix = `${protocol}://${this._host}${portStr}/`;

        return prefix;
    }

    // Expose host and port so that we can configure TrRouting
    public getHostPort(): { host: string; port: number } {
        return { host: this._host, port: this._port };
    }
}

export default OSRMMode;
