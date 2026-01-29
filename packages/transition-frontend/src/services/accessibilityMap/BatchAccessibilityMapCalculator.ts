/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitBatchAccessibilityMap from 'transition-common/lib/services/accessibilityMap/TransitBatchAccessibilityMap';
import { TransitDemandFromCsvAccessMapAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
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
    [key: string]: any;
}

export class BatchAccessibilityMapCalculator {
    private static async _calculate(
        params: TransitDemandFromCsvAccessMapAttributes,
        routingEngine: AccessibilityMapRouting
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TrRoutingConstants.BATCH_ACCESS_MAP,
                params,
                routingEngine.attributes,
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
        updatePreferences = false
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
        const parameters: TransitDemandFromCsvAccessMapAttributes = {
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
            calculatePois: attributes.calculatePois || false,
            calculatePopulation: attributes.calculatePopulation || false,
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
