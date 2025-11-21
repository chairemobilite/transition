/**
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';

import { parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';
import { CsvFieldMappingDescriptor, CsvFileAndMapping, FileConfig } from './types';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

export class CsvFileMapper {
    private _csvFields: string[] = [];
    private _fieldMappings: { [key: string]: string } = {};
    private _csvFile?: FileConfig;
    private _isValid: boolean | undefined = undefined;
    private _errors: ErrorMessage[] = [];

    constructor(
        private mappingDescriptors: CsvFieldMappingDescriptor[],
        csvFileAndMapping?: CsvFileAndMapping | undefined
    ) {
        // Initialize from existing mapping if provided
        if (csvFileAndMapping) {
            this._csvFile = csvFileAndMapping.fileAndMapping.csvFile;
            this._fieldMappings = _cloneDeep(csvFileAndMapping.fileAndMapping.fieldMappings);
            this._csvFields = _cloneDeep(csvFileAndMapping.csvFields);
        }
    }

    private _validateSingleDescriptor(
        descriptor: CsvFieldMappingDescriptor,
        options: {
            suffix?: string;
            isCsvField?: boolean;
        } = {}
    ): true | ErrorMessage[] {
        const suffix = options.suffix ?? '';
        const fieldMappingKey = descriptor.key + suffix;
        const mappedField = this._fieldMappings[fieldMappingKey];
        if (!mappedField) {
            return [
                descriptor.i18nErrorLabel
                    ? descriptor.i18nErrorLabel + suffix
                    : {
                        text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                        params: { field: fieldMappingKey }
                    }
            ];
        } else if (options.isCsvField !== false && !this._csvFields.includes(mappedField)) {
            return [{ text: 'main:errors:csv:FieldNotInCsvFile', params: { field: mappedField } }];
        }
        return true;
    }

    private _descriptorTypeSpecificValidation = (descriptor: CsvFieldMappingDescriptor): true | ErrorMessage[] => {
        const errors: ErrorMessage[] = [];
        switch (descriptor.type) {
        case 'latLon': {
            const latOk = this._validateSingleDescriptor(descriptor, { suffix: 'Lat' });
            if (latOk !== true) {
                errors.push(...latOk);
            }
            const lonOk = this._validateSingleDescriptor(descriptor, { suffix: 'Lon' });
            if (lonOk !== true) {
                errors.push(...lonOk);
            }
            return errors.length === 0 ? true : errors;
        }
        case 'time': {
            const timeOk = this._validateSingleDescriptor(descriptor);
            if (timeOk !== true) {
                errors.push(...timeOk);
            }
            // Validate type and format, they are not csv fields, so just check they are set

            const timeTypeOk = this._validateSingleDescriptor(descriptor, { suffix: 'Type', isCsvField: false });
            if (timeTypeOk !== true) {
                errors.push(...timeTypeOk);
            }
            const timeFormatOk = this._validateSingleDescriptor(descriptor, {
                suffix: 'Format',
                isCsvField: false
            });
            if (timeFormatOk !== true) {
                errors.push(...timeFormatOk);
            }
            return errors.length === 0 ? true : errors;
        }
        case 'single':
            return this._validateSingleDescriptor(descriptor);
        default:
            return this._validateSingleDescriptor(descriptor);
        }
    };

    private _validate(): { isValid: boolean; errors: ErrorMessage[] } {
        let isValid = true;
        const errors: ErrorMessage[] = [];

        if (!this._csvFile) {
            isValid = false;
            errors.push('csv:errors:NoFileSelected');
            return { isValid, errors };
        }

        for (const descriptor of this.mappingDescriptors) {
            if (descriptor.required) {
                const descriptorIsValidOrError = this._descriptorTypeSpecificValidation(descriptor);
                if (descriptorIsValidOrError !== true) {
                    isValid = false;
                    errors.push(...descriptorIsValidOrError);
                }
            }
        }

        return { isValid, errors };
    }

    // Get fields that need to be mapped from the descriptors, excluding type type/format and projection
    private _getCsvFieldsToMap = () => {
        const fieldsToMap: string[] = [];
        this.mappingDescriptors.forEach((descriptor) => {
            switch (descriptor.type) {
            case 'latLon':
                fieldsToMap.push(descriptor.key + 'Lat');
                fieldsToMap.push(descriptor.key + 'Lon');
                break;
            case 'time':
                fieldsToMap.push(descriptor.key);
                break;
            case 'single':
                fieldsToMap.push(descriptor.key);
                break;
            }
        });
        return fieldsToMap;
    };

    async setCsvFile(
        file: string | File | NodeJS.ReadableStream,
        fileLocation: FileConfig | { location: 'upload' }
    ): Promise<string[]> {
        // Get the attributes from the file
        let csvFileAttributes: string[] = [];
        await parseCsvFile(file, (data) => (csvFileAttributes = Object.keys(data)), {
            header: true,
            nbRows: 1 // only get the header
        });

        // Get previous mappings and remove those that are not in the new file
        const validMappings = _cloneDeep(this._fieldMappings);
        this._getCsvFieldsToMap().forEach((key) => {
            if (validMappings[key] !== undefined && !csvFileAttributes.includes(validMappings[key])) {
                delete validMappings[key];
            }
        });

        const newFileConfig: FileConfig =
            fileLocation.location === 'upload'
                ? { location: 'upload', filename: typeof file === 'string' ? file : (file as File).name }
                : fileLocation;
        this._csvFile = newFileConfig;
        this._fieldMappings = validMappings;
        this._csvFields = csvFileAttributes;
        // Reset validations
        this._isValid = undefined; // Invalidate cached validation
        this._errors = [];
        return this._csvFields;
    }

    updateFieldMapping(fieldKey: string, csvField: string): void {
        this._fieldMappings[fieldKey] = csvField;
        // Reset validations
        this._isValid = undefined; // Invalidate cached validation
        this._errors = [];
    }

    getFieldMapping(fieldKey: string): string | undefined {
        return this._fieldMappings[fieldKey];
    }

    getMappingDescriptors(): CsvFieldMappingDescriptor[] {
        return this.mappingDescriptors;
    }

    getCsvFields(): string[] {
        return this._csvFields;
    }

    /**
     * @returns {ErrorMessage[]} An array of error messages. If the object is
     * valid, the array is empty.
     */
    getErrors(): ErrorMessage[] {
        // Cache the validation result
        if (this._isValid === undefined) {
            const { isValid, errors } = this._validate();
            this._errors = errors;
            this._isValid = isValid;
        }
        return this._errors;
    }

    /**
     * Indicates if the object is valid or not.
     *
     * @readonly
     * @type {boolean}
     * @memberof BaseObject
     */
    isValid(): boolean {
        // Cache the validation result
        if (this._isValid === undefined) {
            const { isValid, errors } = this._validate();
            this._errors = errors;
            this._isValid = isValid;
        }
        return this._isValid;
    }

    getCurrentFileAndMapping(): CsvFileAndMapping | undefined {
        if (!this._csvFile) {
            return undefined;
        }
        return {
            type: 'csv',
            fileAndMapping: {
                csvFile: this._csvFile,
                fieldMappings: this._fieldMappings
            },
            csvFields: this._csvFields
        };
    }

    getFileLocation(): FileConfig | undefined {
        return this._csvFile;
    }
}
