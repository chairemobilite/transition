/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import pQueue from 'p-queue';
import { parseOdTripsFromCsv } from '../odTrip/odTripProvider';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitBatchRoutingDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitRoutingValidation, TransitValidationAttributes, TransitValidationMessage } from './TransitRoutingValidation';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { CheckpointTracker } from '../executableJob/JobCheckpointTracker';
import validationResultsDbQueries from '../../models/db/batchValidationResults.db.queries';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

const CHECKPOINT_INTERVAL = 250;

export interface ValidationResult {
    calculationName: string;
    completed: boolean;
    validCount: number;
    invalidCount: number;
    errors: ErrorMessage[];
    warnings: ErrorMessage[];
}

export const batchValidation = async (
    demandParameters: TransitBatchRoutingDemandAttributes,
    validationAttributes: TransitValidationAttributes,
    options: {
        jobId: number;
        absoluteBaseDirectory: string;
        inputFileName: string;
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
        currentCheckpoint?: number;
    }
): Promise<ValidationResult & { files: { input: string } }> => {
    return new TrRoutingValidationBatch(demandParameters.configuration, validationAttributes, options).run();
};

class TrRoutingValidationBatch {
    private odTrips: BaseOdTrip[] = [];
    private errors: ErrorMessage[] = [];
    private warnings: ErrorMessage[] = [];
    private validCount = 0;
    private invalidCount = 0;

    constructor(
        private demandParameters: TransitBatchRoutingDemandAttributes['configuration'],
        private validationAttributes: TransitValidationAttributes,
        private options: {
            jobId: number;
            absoluteBaseDirectory: string;
            inputFileName: string;
            progressEmitter: EventEmitter;
            isCancelled: () => boolean;
            currentCheckpoint?: number;
        }
    ) {
        // Nothing else to do
    }

    run = async (): Promise<ValidationResult & { files: { input: string } }> => {
        console.log('TrRoutingValidationBatch Parameters', this.demandParameters);
        const parameters = this.demandParameters;

        try {
            // Get the odTrips to validate
            const odTripData = await this.getOdTrips();
            this.odTrips = odTripData.odTrips;
            this.warnings = odTripData.errors;

            const odTripsCount = this.odTrips.length;
            console.log(odTripsCount + ' OdTrips parsed');
            this.options.progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });

            // Delete any previous result for this job after checkpoint
            await validationResultsDbQueries.deleteForJob(this.options.jobId, this.options.currentCheckpoint);

            // Prepare indexes for validations and progress report
            const startIndex = this.options.currentCheckpoint || 0;
            let completedValidationsCount = startIndex;
            // Number of od pairs after which to report progress
            const progressStep = Math.ceil(this.odTrips.length / 100);

            this.options.progressEmitter.emit('progress', {
                name: 'BatchValidation',
                progress: completedValidationsCount / odTripsCount
            });

            const promiseQueue = new pQueue({ concurrency: 10 }); // Adjust concurrency as needed

            // Log progress at most for each 1% progress
            const logInterval = Math.ceil(odTripsCount / 100);
            const logOdTripBefore = (index: number) => {
                if ((index + 1) % logInterval === 0) {
                    console.log(`Validating odTrip ${index + 1}/${odTripsCount}`);
                }
            };
            
            const checkpointTracker = new CheckpointTracker(
                CHECKPOINT_INTERVAL,
                this.options.progressEmitter,
                this.options.currentCheckpoint
            );
            
            for (let odTripIndex = startIndex; odTripIndex < odTripsCount; odTripIndex++) {
                promiseQueue.add(async () => {
                    // Assert the job is not cancelled, otherwise clear the queue and let the job exit
                    if (this.options.isCancelled()) {
                        promiseQueue.clear();
                    }
                    try {
                        console.log('validation: Start handling validation for odTrip %d', odTripIndex);
                        await this.odTripValidationTask(odTripIndex, {
                            logBefore: logOdTripBefore
                        });
                    } finally {
                        try {
                            completedValidationsCount++;
                            if (completedValidationsCount % progressStep === 0) {
                                this.options.progressEmitter.emit('progress', {
                                    name: 'BatchValidation',
                                    progress: completedValidationsCount / odTripsCount
                                });
                            }
                            console.log('validation: Handled validation for odTrip %d', odTripIndex);
                            checkpointTracker.handled(odTripIndex);
                        } catch (error) {
                            console.error(
                                `validation: Error completing od trip validation. The checkpoint will be missed: ${odTripIndex}: ${error}`
                            );
                        }
                    }
                });
            }

            await promiseQueue.onIdle();
            console.log('Batch odTrip validation completed for job %d', this.options.jobId);
            checkpointTracker.completed();

            this.options.progressEmitter.emit('progress', { name: 'BatchValidation', progress: 1.0 });

            const validationResult: ValidationResult & { files: { input: string } } = {
                calculationName: parameters.calculationName,
                completed: true,
                validCount: this.validCount,
                invalidCount: this.invalidCount,
                errors: this.errors,
                warnings: this.warnings,
                files: { input: this.options.inputFileName }
            };

            return validationResult;
        } catch (error) {
            if (Array.isArray(error)) {
                console.log('Multiple errors in batch validation for job %d', this.options.jobId);
                return {
                    calculationName: parameters.calculationName,
                    completed: false,
                    validCount: this.validCount,
                    invalidCount: this.invalidCount,
                    errors: error,
                    warnings: this.warnings,
                    files: { input: this.options.inputFileName }
                };
            } else {
                console.error(`Error in batch validation job ${this.options.jobId}: ${error}`);
                throw error;
            }
        }
    };

    private getOdTrips = async (): Promise<{
        odTrips: BaseOdTrip[];
        errors: ErrorMessage[];
    }> => {
        console.log(`importing od trips from CSV file ${this.options.inputFileName}`);
        console.log('reading data from csv file...');

        const { odTrips, errors } = await parseOdTripsFromCsv(
            `${this.options.absoluteBaseDirectory}/${this.options.inputFileName}`,
            this.demandParameters
        );

        const odTripsCount = odTrips.length;
        console.log(odTripsCount + ' OdTrips parsed');
        this.options.progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });
        return { odTrips, errors };
    };

    private odTripValidationTask = async (
        odTripIndex: number,
        options: {
            logBefore: (index: number) => void;
        }
    ) => {
        const odTrip = this.odTrips[odTripIndex];
        try {
            options.logBefore(odTripIndex);

            const origDestStr = `${odTrip.attributes.origin_geography.coordinates.join(',')} to ${odTrip.attributes.destination_geography.coordinates.join(',')}`;
            console.log('validation: Validating odTrip %d with coordinates %s', odTripIndex, origDestStr);
            
            // Extract declared trip from odTrip attributes
            const declaredTrip = odTrip.attributes.declaredTrip || [];
            
            // Calculate date from time of trip
            const timeOfTrip = odTrip.attributes.timeOfTrip || 0;
            const dateOfTrip = new Date(timeOfTrip * 1000); // Convert seconds to milliseconds
            
            // Create validation instance and run validation
            const validation = new TransitRoutingValidation(this.validationAttributes);
            const validationResult = await validation.run({
                odTrip,
                dateOfTrip,
                declaredTrip
            });

            // Store result in database
            await validationResultsDbQueries.create({
                job_id: this.options.jobId,
                trip_index: odTripIndex,
                valid: validationResult === true,
                data: validationResult === true ? { valid: true } : validationResult
            });

            // Update counts
            if (validationResult === true) {
                this.validCount++;
            } else {
                this.invalidCount++;
            }

            return validationResult;
        } catch (error) {
            this.errors.push({
                text: 'transit:transitRouting:errors:ErrorValidatingOdTrip',
                params: { id: odTrip.attributes.internal_id || String(odTripIndex) }
            });
            console.error(`Error validating od trip for ${odTripIndex}: ${error}`);
            
            // Store error in database
            await validationResultsDbQueries.create({
                job_id: this.options.jobId,
                trip_index: odTripIndex,
                valid: false,
                data: {
                    type: 'error',
                    error: TrError.isTrError(error) ? error.export() : String(error)
                }
            });
            
            this.invalidCount++;
        }
    };
}
