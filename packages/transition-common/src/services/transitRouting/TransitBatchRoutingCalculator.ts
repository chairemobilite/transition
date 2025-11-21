/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TrRoutingConstants } from 'chaire-lib-common/lib/api/TrRouting';
import { TransitBatchCalculationResult } from '../batchCalculation/types';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import TransitOdDemandFromCsv from '../transitDemand/TransitOdDemandFromCsv';
import { BatchCalculationParameters, isBatchParametersValid } from '../batchCalculation/types';
import { CsvFileAndMapping } from '../csv';

export class TransitBatchRoutingCalculator {
    private static async _calculate(
        params: CsvFileAndMapping,
        queryAttributes: BatchCalculationParameters
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TrRoutingConstants.BATCH_ROUTE,
                params,
                queryAttributes,
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
        transitDemand: TransitOdDemandFromCsv,
        queryAttributes: BatchCalculationParameters
    ): Promise<TransitBatchCalculationResult> {
        if (!transitDemand.isValid()) {
            const trError = new TrError(
                'cannot calculate transit batch route: the CSV file data is invalid',
                'TRBROUTING0001',
                'transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }
        if (!isBatchParametersValid(queryAttributes).valid) {
            const trError = new TrError(
                'cannot calculate transit batch route: the routing parameters are invalid',
                'TRBROUTING0002',
                'transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }

        const parameters = transitDemand.getCurrentFileAndMapping()!;

        try {
            const batchResult = await TransitBatchRoutingCalculator._calculate(parameters, queryAttributes);
            return batchResult;
        } catch (error) {
            // TODO Better handle erroneous and success return statuses
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `cannot calculate transit batch route with trRouting: ${error}`,
                'TRBROUTING0001',
                'transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError'
            );
            console.error(trError.export());
            throw trError;
            // FIXME:  Not part of the promise, can't resolve the error here
            // resolve(trError.export());
        }
    }

    static async getCalculationParametersForJob(jobId: number): Promise<{
        parameters: BatchCalculationParameters;
        demand: CsvFileAndMapping;
        csvFields: string[];
    }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TrRoutingConstants.BATCH_ROUTE_REPLAY,
                jobId,
                (
                    routingStatus: Status.Status<{
                        parameters: BatchCalculationParameters;
                        demand: CsvFileAndMapping;
                        csvFields: string[];
                    }>
                ) => {
                    if (Status.isStatusOk(routingStatus)) {
                        resolve(Status.unwrap(routingStatus));
                    } else if (routingStatus.error === 'InputFileUnavailable') {
                        reject(
                            new TrError(
                                'Input file has not been found',
                                'TRJOB0002',
                                'transit:batchCalculation:errors:InputFileUnavailable'
                            )
                        );
                    } else {
                        reject(routingStatus.error);
                    }
                }
            );
        });
    }
}

export default TransitBatchRoutingCalculator;
