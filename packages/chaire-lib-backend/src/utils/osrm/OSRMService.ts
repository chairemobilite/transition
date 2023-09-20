/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash/get';

import osrm from 'osrm';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { transitionRouteOptions, transitionMatchOptions } from 'chaire-lib-common/lib/api/OSRMRouting';
import * as RoutingService from 'chaire-lib-common/lib/services/routing/RoutingService';
import { RoutingMode, routingModes } from 'chaire-lib-common/lib/config/routingModes';

import OSRMMode from './OSRMMode';

class OSRMService {
    private _modeRegistry: Record<RoutingMode, OSRMMode>;

    constructor() {
        this._modeRegistry = {} as Record<RoutingMode, OSRMMode>;
    }

    public route(parameters: transitionRouteOptions): Promise<Status.Status<osrm.RouteResults>> {
        return this.getMode(parameters.mode).route(parameters);
    }

    public match(parameters: transitionMatchOptions): Promise<Status.Status<osrm.MatchResults>> {
        return this.getMode(parameters.mode).match(parameters);
    }

    public tableFrom(
        parameters: RoutingService.TableFromParameters
    ): Promise<Status.Status<RoutingService.TableResults>> {
        return this.getMode(parameters.mode).tableFrom(parameters);
    }

    public tableTo(parameters: RoutingService.TableToParameters): Promise<Status.Status<RoutingService.TableResults>> {
        return this.getMode(parameters.mode).tableTo(parameters);
    }

    public registerMode(mode: RoutingMode, instance: OSRMMode) {
        //TODO Warn when overwriting a mode
        //TODO Validate that OSRMMode contains the same RoutingMode as mode
        this._modeRegistry[mode] = instance;
    }

    // Set as public, to be used by TrRoutingProcessManager
    public getMode(mode: RoutingMode): OSRMMode {
        if (mode in this._modeRegistry) {
            return this._modeRegistry[mode];
        } else {
            throw new Error('Mode not in registry ' + mode);
        }
    }
}

// singleton:
const instance = new OSRMService();
Object.freeze(instance);

export default instance;
