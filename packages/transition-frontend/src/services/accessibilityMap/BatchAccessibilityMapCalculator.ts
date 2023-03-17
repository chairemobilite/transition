/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitBatchAccessibilityMap from 'transition-common/lib/services/accessibilityMap/TransitBatchAccessibilityMap';
import {
    TransitBatchAccessibilityMapAttributes as TransitBatchAccessibilityMapAttributesBase,
    TransitBatchCalculationResult
} from 'chaire-lib-common/lib/api/TrRouting';
import { TrRoutingConstants } from 'chaire-lib-common/lib/api/TrRouting';
import AccessibilityMapRouting from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import * as Status from 'chaire-lib-common/lib/utils/Status';

export interface TransitMapCalculationOptions {
    isCancelled?: (() => boolean) | false;
    port?: number;
    /**
     * Additional properties to add to each accessibility polygon calculated
     *
     * @type {{ [key: string]: any }}
     * @memberof TransitMapCalculationOptions
     */
    additionalProperties?: { [key: string]: any };
    accessibleNodes?: { ids: string[]; durations: number[] };
    [key: string]: any;
}

export class BatchAccessibilityMapCalculator {
    private static async _calculate(
        params: TransitBatchAccessibilityMapAttributesBase,
        routingEngine: AccessibilityMapRouting
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TrRoutingConstants.BATCH_ACCESS_MAP,
                params,
                routingEngine.getAttributes(),
                (routingStatus: Status.Status<TransitBatchCalculationResult>) => {
                    if (Status.isStatusOk(routingStatus)) {
                        resolve(Status.unwrap(routingStatus));
                    } else if (routingStatus.error === 'UserDiskQuotaReached') {
                        reject(
                            new TrError(
                                'Maximum allowed disk space reached',
                                'TRJOB0001',
                                'transit:transitRouting:errors:UserDiskQuotaReached'
                            )
                        );
                    } else {
                        reject(routingStatus.error);
                    }
                }
            );
        });
    }

    static async calculate(
        accessMap: TransitBatchAccessibilityMap,
        updatePreferences = false,
        options = {}
    ): Promise<TransitBatchCalculationResult> {
        if (!accessMap.validate()) {
            const trError = new TrError(
                'cannot calculate batch accessibility map: the data is invalid',
                'TRBROUTING0001',
                'transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }
        if (updatePreferences) {
            accessMap.updateRoutingPrefs();
        }

        const attributes = accessMap.attributes;
        const parameters: TransitBatchAccessibilityMapAttributesBase = {
            calculationName: attributes.calculationName as string,
            projection: attributes.projection as string,
            detailed: attributes.detailed || false,
            idAttribute: attributes.idAttribute as string,
            xAttribute: attributes.xAttribute as string,
            yAttribute: attributes.yAttribute as string,
            timeAttributeDepartureOrArrival: attributes.timeAttributeDepartureOrArrival || 'departure',
            timeFormat: attributes.timeFormat as string,
            timeAttribute: attributes.timeAttribute as string,
            withGeometries: attributes.withGeometries || false,
            cpuCount: attributes.cpuCount || 1,
            csvFile: attributes.csvFile || { location: 'upload', filename: 'batchAccessMap.csv' }
        };

        try {
            const batchResult = await this._calculate(parameters, accessMap.routingEngine);
            return batchResult;
        } catch (error) {
            // TODO Better handle erroneous and success return statuses
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `'cannot calculate batch accessibility map with trRouting: ${error}`,
                'TRBROUTING0001',
                'transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }
    }
}
