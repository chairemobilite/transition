/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import TransitAccessibilityMapRouting from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import { TransitMapCalculationOptions } from 'transition-common/lib/services/accessibilityMap/types';
import { TransitAccessibilityMapWithPolygonResult } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';

export const calculateRouting = async (
    routing: TransitRouting,
    updatePreferences = false,
    options: { isCancelled?: () => boolean; [key: string]: any } = {}
): Promise<RoutingResultsByMode> => {
    return new Promise((resolve, reject) => {
        // Update preferences if needed
        if (updatePreferences) {
            routing.updateRoutingPrefs();
        }
        // Add the walking mode if transit was requested so it is added to the results
        const tripQueryAttributes = routing.toTripRoutingQueryAttributes();
        if (
            tripQueryAttributes.routingModes.includes('transit') &&
            !tripQueryAttributes.routingModes.includes('walking')
        ) {
            // force add walking when selecting transit mode, so we can check if walking is better
            const routingModes = [...tripQueryAttributes.routingModes];
            routingModes.push('walking');
            tripQueryAttributes.routingModes = routingModes;
        }
        serviceLocator.socketEventManager.emit(
            'routing.calculate',
            tripQueryAttributes,
            (routingResult: Status.Status<RoutingResultsByMode>) => {
                if (options.isCancelled && options.isCancelled()) {
                    reject('Cancelled');
                }
                if (Status.isStatusOk(routingResult)) {
                    const results = Status.unwrap(routingResult);
                    const requestedResults = {};
                    Object.keys(results)
                        .filter((mode) => routing.attributes.routingModes?.includes(mode as RoutingOrTransitMode))
                        .forEach((mode) => {
                            requestedResults[mode] = results[mode];
                        });
                    resolve(requestedResults);
                } else {
                    reject(routingResult.error);
                }
            }
        );
    });
};

export const calculateAccessibilityMap = async (
    routing: TransitAccessibilityMapRouting,
    updatePreferences = false,
    options: TransitMapCalculationOptions = {}
): Promise<TransitAccessibilityMapWithPolygonResult> => {
    return new Promise((resolve, reject) => {
        // Update preferences if needed
        if (updatePreferences) {
            routing.updateRoutingPrefs();
        }

        serviceLocator.socketEventManager.emit(
            'accessibiliyMap.calculateWithPolygons',
            routing.getAttributes(),
            options,
            (mapResult: Status.Status<TransitAccessibilityMapWithPolygonResult>) => {
                if (options.isCancelled && options.isCancelled()) {
                    reject('Cancelled');
                }
                if (Status.isStatusOk(mapResult)) {
                    resolve(Status.unwrap(mapResult));
                } else {
                    reject(mapResult.error);
                }
            }
        );
    });
};
