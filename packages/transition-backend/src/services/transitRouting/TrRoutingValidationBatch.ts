/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import pQueue from 'p-queue';
import { parseOdTripsFromCsv } from '../odTrip/odTripProviderForValidation';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitBatchValidationDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import { DeclaredLine, TransitRoutingValidation, TransitValidationAttributes } from './TransitRoutingValidation';
import { CheckpointTracker } from '../executableJob/JobCheckpointTracker';
import validationResultsDbQueries from '../../models/db/batchRouteResults.db.queries';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { createValidationFileResultProcessor, formatValidationResultForCsv } from './TrRoutingValidationResult';
import { TripValidationResult } from './types';

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
    demandParameters: TransitBatchValidationDemandAttributes,
    validationAttributes: TransitValidationAttributes,
    options: {
        jobId: number;
        absoluteBaseDirectory: string;
        inputFileName: string;
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
        currentCheckpoint?: number;
    }
): Promise<ValidationResult & { files: { input: string; csv?: string } }> => {
    return new TrRoutingValidationBatch(demandParameters.configuration, validationAttributes, options).run();
};

class TrRoutingValidationBatch {
    private odTrips: { trip: BaseOdTrip; date?: Date; declaredTrip: DeclaredLine[] }[] = [];
    private errors: ErrorMessage[] = [];
    private warnings: ErrorMessage[] = [];
    private validCount = 0;
    private invalidCount = 0;
    private validation: TransitRoutingValidation;

    constructor(
        private demandParameters: TransitBatchValidationDemandAttributes['configuration'],
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
        // Create validation instance and run validation
        this.validation = new TransitRoutingValidation(this.validationAttributes);
    }

    run = async (): Promise<ValidationResult & { files: { input: string; csv?: string } }> => {
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

            const promiseQueue = new pQueue({ concurrency: 1 }); // Adjust concurrency as needed

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

            // Generate the output files
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 0.0 });
            const files = await this.generateResultFiles();
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 1.0 });

            const validationResult: ValidationResult & { files: { input: string; csv?: string } } = {
                calculationName: parameters.calculationName,
                completed: true,
                validCount: this.validCount,
                invalidCount: this.invalidCount,
                errors: this.errors,
                warnings: this.warnings,
                files
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
        odTrips: { trip: BaseOdTrip; date?: Date; declaredTrip: DeclaredLine[] }[];
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

            const origDestStr = `${odTrip.trip.attributes.origin_geography.coordinates.join(',')} to ${odTrip.trip.attributes.destination_geography.coordinates.join(',')}`;
            console.log('validation: Validating odTrip %d with coordinates %s', odTripIndex, origDestStr);

            const validationResult = await this.validation.run({
                odTrip: odTrip.trip,
                dateOfTrip: odTrip.date,
                declaredTrip: odTrip.declaredTrip
            });

            // Store result in database and for file generation
            const resultData = {
                uuid: odTrip.trip.getId(),
                internalId: odTrip.trip.attributes.internal_id || String(odTripIndex),
                origin: odTrip.trip.attributes.origin_geography,
                destination: odTrip.trip.attributes.destination_geography,
                results: validationResult,
                valid: validationResult === true || false
            };

            await validationResultsDbQueries.create({
                jobId: this.options.jobId,
                tripIndex: odTripIndex,
                data: resultData
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
                params: { id: odTrip.trip.attributes.internal_id || String(odTripIndex) }
            });
            console.error(`Error validating od trip for ${odTripIndex}: ${error}`);

            this.invalidCount++;
        }
    };

    private generateResultFiles = async (): Promise<{ input: string; csv?: string }> => {
        console.log('Preparing validation result files for job %d...', this.options.jobId);

        // Create a result processor
        const resultProcessor = createValidationFileResultProcessor(
            this.options.absoluteBaseDirectory,
            this.demandParameters,
            this.validationAttributes,
            this.options.inputFileName
        );

        console.log('Processing validation results for job %d...', this.options.jobId);

        // Get results from database
        const resultCount = await validationResultsDbQueries.countResults(this.options.jobId);
        const logInterval = Math.ceil(resultCount / 100);
        let currentResultIdx = 0;

        console.log('Generating %d validation results for job %d...', resultCount, this.options.jobId);
        const resultStream = validationResultsDbQueries.streamResults(this.options.jobId);

        for await (const row of resultStream) {
            currentResultIdx++;
            if (currentResultIdx % logInterval === 0 || currentResultIdx === resultCount) {
                console.log(
                    'Generating validation results %d of %d for job %d...',
                    currentResultIdx,
                    resultCount,
                    this.options.jobId
                );
            }

            const result = validationResultsDbQueries.resultParser(row);
            console.log('Processing validation result for job %d, od trip %d', this.options.jobId, result.tripIndex);

            // Process the validation result for CSV output
            const rowData = formatValidationResultForCsv(result.data as TripValidationResult);

            resultProcessor.processResult(rowData);
        }

        resultProcessor.end();
        console.log('Generated validation results for job %d', this.options.jobId);

        return resultProcessor.getFiles();
    };
}
