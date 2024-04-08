/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import APIResponseBase from './APIResponseBase';

export default class RoutingModesAPIResponse extends APIResponseBase<RoutingOrTransitMode[]> {
    protected createResponse(input: RoutingOrTransitMode[]): RoutingOrTransitMode[] {
        return input;
    }
}
