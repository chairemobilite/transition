/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { TransitApi } from 'transition-common/lib/api/transit';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';

export class NetworkDesignFrontendExecutor {
    private static async _calculate(
        transitNetworkDesignJobParameters: TransitNetworkJobConfigurationType
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_CREATE,
                transitNetworkDesignJobParameters,
                (routingStatus: Status.Status<unknown>) => {
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

    // TODO Properly type the return value
    static async execute(transitNetworkDesignJobParameters: TransitNetworkJobConfigurationType): Promise<unknown> {
        // TODO Validate parameters before sending query

        try {
            const jobStatus = await NetworkDesignFrontendExecutor._calculate(transitNetworkDesignJobParameters);
            return jobStatus;
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
        }
    }

    static async getCalculationParametersForJob(jobId: number): Promise<TransitNetworkJobConfigurationType> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_REPLAY,
                jobId,
                (routingStatus: Status.Status<TransitNetworkJobConfigurationType>) => {
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

export default NetworkDesignFrontendExecutor;
