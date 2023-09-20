/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import {
    base as baseAttributes,
    transit as transitAttributes,
    steps as transitStepsAttributes
} from '../../config/trRoutingAttributes';
import { routingModes, RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';

export const getDefaultCsvAttributes = (modes: RoutingOrTransitMode[]): { [key: string]: string | number | null } => {
    const csvAttributes = _cloneDeep(baseAttributes);
    if (modes.includes('transit')) {
        Object.assign(csvAttributes, _cloneDeep(transitAttributes));
    }
    // Add a time and distance column per non-transit mode
    modes.forEach((mode: any) => {
        if (routingModes.includes(mode)) {
            csvAttributes[`only${mode.charAt(0).toUpperCase() + mode.slice(1)}TravelTimeSeconds`] = null;
            csvAttributes[`only${mode.charAt(0).toUpperCase() + mode.slice(1)}DistanceMeters`] = null;
        }
    });
    return csvAttributes;
};

export const getDefaultStepsAttributes = () => {
    return _cloneDeep(transitStepsAttributes);
};
