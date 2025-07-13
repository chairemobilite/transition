/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { unparse } from 'papaparse';
import { TransitBatchValidationDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitValidationAttributes, TransitValidationMessage } from './TransitRoutingValidation';
import { TripValidationResult } from './types';

const VALIDATION_CSV_FILE_NAME = 'validationResults.csv';

export interface ValidationResultProcessor {
    processResult: (validationResult: ValidationRowData) => void;
    end: () => void;
    getFiles: () => { input: string; csv?: string };
}

export interface ValidationRowData {
    uuid: string;
    internalId: string;
    originLat?: number | string;
    originLon?: number | string;
    destinationLat?: number | string;
    destinationLon?: number | string;
    valid?: boolean;
    message?: string;
    lines?: string;
    unreachableOrigin?: string;
    unreachableDestination?: string;
}

/**
 * Factory method to create a validation result processor that writes to files
 */
export const createValidationFileResultProcessor = (
    absoluteDirectory: string,
    demandParameters: TransitBatchValidationDemandAttributes['configuration'],
    validationAttributes: TransitValidationAttributes,
    inputFileName: string
): ValidationResultProcessor => {
    return new ValidationResultProcessorFile(absoluteDirectory, demandParameters, validationAttributes, inputFileName);
};

class ValidationResultProcessorFile implements ValidationResultProcessor {
    private readonly resultsCsvFilePath = `${this.absoluteDirectory}/${VALIDATION_CSV_FILE_NAME}`;
    private readonly inputFile = `${this.absoluteDirectory}/${this.inputFileName}`;
    private csvStream: fs.WriteStream | undefined;

    constructor(
        private absoluteDirectory: string,
        private demandParameters: TransitBatchValidationDemandAttributes['configuration'],
        private validationAttributes: TransitValidationAttributes,
        private inputFileName: string
    ) {
        this.initResultFile();
    }

    private initResultFile = () => {
        this.csvStream = fs.createWriteStream(this.resultsCsvFilePath);
        this.csvStream.on('error', console.error);
        // Define CSV headers based on the validation data structure
        const headers: (keyof ValidationRowData)[] = [
            'uuid',
            'internalId',
            'originLat',
            'originLon',
            'destinationLat',
            'destinationLon',
            'valid',
            'message',
            'lines',
            'unreachableOrigin',
            'unreachableDestination'
        ];
        this.csvStream.write(headers.join(',') + '\n');
    };

    processResult = (result: ValidationRowData) => {
        if (this.csvStream) {
            const csvRow: Required<ValidationRowData> = {
                uuid: result.uuid || '',
                internalId: result.internalId || '',
                originLat: result.originLat || '',
                originLon: result.originLon || '',
                destinationLat: result.destinationLat || '',
                destinationLon: result.destinationLon || '',
                valid: result.valid || false,
                message: result.message || '',
                lines: result.lines || '',
                unreachableOrigin: result.unreachableOrigin || '',
                unreachableDestination: result.unreachableDestination || ''
            };
            this.csvStream.write(unparse([csvRow], { header: false }) + '\n');
        }
    };

    end = () => {
        if (this.csvStream) {
            this.csvStream.end();
        }
    };

    getFiles = () => ({
        input: this.inputFileName,
        csv: VALIDATION_CSV_FILE_NAME
    });
}

const getLineData = (message?: TransitValidationMessage | boolean): string => {
    if (!message || typeof message === 'boolean') {
        return '';
    }
    if (
        message.type === 'lineNotFound' ||
        message.type === 'noServiceOnLine' ||
        message.type === 'noServiceOnLineAtTime'
    ) {
        return message.line.map((line) => `${line.agency}:${line.line}`).join(', ');
    }
    return '';
};

const getUnreachableOrigin = (message?: TransitValidationMessage | boolean): string => {
    if (!message || typeof message === 'boolean') {
        return '';
    }
    if (message.type === 'walkingDistanceTooLong') {
        return message.origin === 'origin' ? 'origin' : message.origin.line;
    }
    if (message.type === 'incompatibleTrip') {
        return `${message.originLine.agency}:${message.originLine.line}`;
    }
    return '';
};

const getUnreachableDestination = (message?: TransitValidationMessage | boolean): string => {
    if (!message || typeof message === 'boolean') {
        return '';
    }
    if (message.type === 'walkingDistanceTooLong') {
        return message.destination === 'destination' ? 'destination' : message.destination.line;
    }
    if (message.type === 'incompatibleTrip') {
        return `${message.destinationLine.agency}:${message.destinationLine.line}`;
    }
    return '';
};

export const formatValidationResultForCsv = (validationResult: TripValidationResult): ValidationRowData => {
    // Extract required data from validationResult and format it for CSV
    // This will depend on the structure of your validation results
    const rowData: ValidationRowData = {
        uuid: validationResult.uuid,
        internalId: validationResult.internalId,
        originLat: validationResult.origin?.coordinates[1],
        originLon: validationResult.origin?.coordinates[0],
        destinationLat: validationResult.destination?.coordinates[1],
        destinationLon: validationResult.destination?.coordinates[0],
        valid: validationResult.valid,
        message:
            validationResult.results && validationResult.results === true
                ? 'found'
                : validationResult.results
                    ? validationResult.results.type
                    : '',
        lines: getLineData(validationResult.results),
        unreachableOrigin: getUnreachableOrigin(validationResult.results),
        unreachableDestination: getUnreachableDestination(validationResult.results)
    };

    return rowData;
};
