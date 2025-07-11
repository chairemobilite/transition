/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitApi } from '../../api/transit';
import { TransitBatchValidationDemandAttributes } from '../transitDemand/types';
import { TransitBatchCalculationResult } from '../batchCalculation/types';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { BatchCalculationParameters, isBatchParametersValid } from '../batchCalculation/types';
import TransitValidationDemandFromCsv from '../transitDemand/TransitValidationDemandFromCsv';

export class TransitBatchRoutingValidator {
    private static async _validate(
        params: TransitBatchValidationDemandAttributes,
        validationAttributes: BatchCalculationParameters
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.BATCH_VALIDATE,
                params,
                validationAttributes,
                (validationStatus: Status.Status<TransitBatchCalculationResult>) => {
                    if (Status.isStatusOk(validationStatus)) {
                        resolve(Status.unwrap(validationStatus));
                    } else if (validationStatus.error === 'UserDiskQuotaReached') {
                        reject(
                            new TrError(
                                'Maximum allowed disk space reached',
                                'TRJOB0001',
                                'transit:transitRouting:errors:UserDiskQuotaReached'
                            )
                        );
                    } else {
                        reject(validationStatus.error);
                    }
                }
            );
        });
    }

    static async validate(
        transitDemand: TransitValidationDemandFromCsv,
        validationAttributes: BatchCalculationParameters
    ): Promise<TransitBatchCalculationResult> {
        if (!transitDemand.validate()) {
            const trError = new TrError(
                'cannot validate transit batch route: the CSV file data is invalid',
                'TRBVALIDATION0001',
                'transit:transitRouting:errors:TransitBatchValidationCannotBeProcessedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }
        if (!isBatchParametersValid(validationAttributes).valid) {
            const trError = new TrError(
                'cannot validate transit batch route: the routing parameters are invalid',
                'TRBVALIDATION0002',
                'transit:transitRouting:errors:TransitBatchValidationCannotBeProcessedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }

        const attributes = transitDemand.attributes;
        const parameters: TransitBatchValidationDemandAttributes = {
            type: 'csv',
            configuration: {
                calculationName: attributes.calculationName as string,
                projection: attributes.projection as string,
                idAttribute: attributes.idAttribute as string,
                originXAttribute: attributes.originXAttribute as string,
                originYAttribute: attributes.originYAttribute as string,
                destinationXAttribute: attributes.destinationXAttribute as string,
                destinationYAttribute: attributes.destinationYAttribute as string,
                timeAttributeDepartureOrArrival: attributes.timeAttributeDepartureOrArrival || 'departure',
                timeFormat: attributes.timeFormat as string,
                timeAttribute: attributes.timeAttribute as string,
                agenciesAttributePrefix: attributes.agenciesAttributePrefix as string,
                linesAttributePrefix: attributes.linesAttributePrefix as string,
                tripDateAttribute: attributes.tripDateAttribute as string,
                saveToDb: attributes.saveToDb || false,
                csvFile:
                    attributes.csvFile === undefined
                        ? { location: 'upload', filename: 'batchValidation.csv' }
                        : attributes.csvFile
            }
        };

        try {
            const batchResult = await TransitBatchRoutingValidator._validate(parameters, validationAttributes);
            return batchResult;
        } catch (error) {
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `cannot validate transit batch route: ${error}`,
                'TRBVALIDATION0001',
                'transit:transitRouting:errors:TransitBatchValidationCannotBeProcessedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }
    }

    static async getValidationParametersForJob(jobId: number): Promise<{
        parameters: BatchCalculationParameters;
        demand: TransitBatchValidationDemandAttributes;
        csvFields: string[];
    }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.BATCH_VALIDATE_REPLAY,
                jobId,
                (
                    validationStatus: Status.Status<{
                        parameters: BatchCalculationParameters;
                        demand: TransitBatchValidationDemandAttributes;
                        csvFields: string[];
                    }>
                ) => {
                    if (Status.isStatusOk(validationStatus)) {
                        resolve(Status.unwrap(validationStatus));
                    } else if (validationStatus.error === 'InputFileUnavailable') {
                        reject(
                            new TrError(
                                'Input file has not been found',
                                'TRJOB0002',
                                'transit:batchCalculation:errors:InputFileUnavailable'
                            )
                        );
                    } else {
                        reject(validationStatus.error);
                    }
                }
            );
        });
    }
}

export default TransitBatchRoutingValidator;
