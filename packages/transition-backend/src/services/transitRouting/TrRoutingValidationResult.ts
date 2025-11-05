/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { unparse } from 'papaparse';
import { TransitBatchValidationDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import { DeclaredLine, TransitValidationAttributes, TransitValidationMessage } from './TransitRoutingValidation';
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
    agency?: string;
    lines?: string;
    unreachableOrigin?: string;
    unreachableDestination?: string;
    unreachableDistanceMeters?: number | string;
    accessDistanceMeters?: number | string;
    egressDistanceMeters?: number | string;
    transferDistanceMetersTotal?: number | string;
    transferDistancesMeters?: string;
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
            'agency',
            'lines',
            'unreachableOrigin',
            'unreachableDestination',
            'unreachableDistanceMeters',
            'accessDistanceMeters',
            'egressDistanceMeters',
            'transferDistanceMetersTotal',
            'transferDistancesMeters'
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
                agency: result.agency || '',
                lines: result.lines || '',
                unreachableOrigin: result.unreachableOrigin || '',
                unreachableDestination: result.unreachableDestination || '',
                unreachableDistanceMeters: result.unreachableDistanceMeters || '',
                accessDistanceMeters: result.accessDistanceMeters || '',
                egressDistanceMeters: result.egressDistanceMeters || '',
                transferDistanceMetersTotal: result.transferDistanceMetersTotal || '',
                transferDistancesMeters: result.transferDistancesMeters || ''
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

const declaredLineToString = (line: DeclaredLine): string => `${line.agency}:${line.line}`;

const getLineData = (message?: TransitValidationMessage | boolean): string => {
    if (!message || typeof message === 'boolean') {
        return '';
    }
    if (
        message.type === 'lineNotFound' ||
        message.type === 'noServiceOnLine' ||
        message.type === 'noServiceOnLineAtTime'
    ) {
        return message.line.map(declaredLineToString).join(', ');
    }
    return '';
};

const getUnreachableOrigin = (message?: TransitValidationMessage | boolean): string => {
    if (!message || typeof message === 'boolean') {
        return '';
    }
    if (message.type === 'walkingDistanceTooLong') {
        return message.origin === 'origin' ? 'origin' : declaredLineToString(message.origin);
    }
    if (message.type === 'incompatibleTrip') {
        return declaredLineToString(message.originLine);
    }
    return '';
};

const getUnreachableDestination = (message?: TransitValidationMessage | boolean): string => {
    if (!message || typeof message === 'boolean') {
        return '';
    }
    if (message.type === 'walkingDistanceTooLong') {
        return message.destination === 'destination' ? 'destination' : declaredLineToString(message.destination);
    }
    if (message.type === 'incompatibleTrip') {
        return declaredLineToString(message.destinationLine);
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
        message: validationResult.results ? validationResult.results.type : '',
        agency:
            validationResult.results && validationResult.results.type === 'missingLineForAgency'
                ? validationResult.results.agency
                : '',
        lines: getLineData(validationResult.results),
        unreachableOrigin: getUnreachableOrigin(validationResult.results),
        unreachableDestination: getUnreachableDestination(validationResult.results),
        unreachableDistanceMeters:
            validationResult.results && validationResult.results.type === 'walkingDistanceTooLong'
                ? validationResult.results.distanceMeters
                : '',
        accessDistanceMeters:
            validationResult.results && validationResult.results.type === 'validTrip'
                ? validationResult.results.accessDistanceMeters
                : '',
        egressDistanceMeters:
            validationResult.results && validationResult.results.type === 'validTrip'
                ? validationResult.results.egressDistanceMeters
                : '',
        transferDistanceMetersTotal:
            validationResult.results && validationResult.results.type === 'validTrip'
                ? validationResult.results.transferDistancesMeters.reduce((sum, val) => sum + val, 0)
                : '',
        transferDistancesMeters:
            validationResult.results && validationResult.results.type === 'validTrip'
                ? validationResult.results.transferDistancesMeters.join('|')
                : ''
    };

    return rowData;
};
