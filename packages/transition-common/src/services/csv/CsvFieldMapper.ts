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

/**
 * A class to manage CSV field mapping from CSV fields to application fields
 * described by descriptors.
 */
export class CsvFieldMapper<T extends Record<string, string> = Record<string, string>> {
    protected _csvFields: string[] = [];
    protected _fieldMappings: Partial<T> = {};
    private _isValid: boolean | undefined = undefined;
    private _errors: ErrorMessage[] = [];

    constructor(
        protected mappingDescriptors: CsvFieldMappingDescriptor[],
        csvFields?: string[],
        fieldMappings?: Partial<T>
    ) {
        if (csvFields) {
            this._csvFields = _cloneDeep(csvFields);
        }
        if (fieldMappings) {
            this._fieldMappings = _cloneDeep(fieldMappings);
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
        case 'routingTime': {
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

    protected _validate(): { isValid: boolean; errors: ErrorMessage[] } {
        let isValid = true;
        const errors: ErrorMessage[] = [];

        if (this._csvFields.length === 0) {
            isValid = false;
            errors.push('main:errors:csv:NoFileSelected');
            return { isValid, errors };
        }

        // Validate also the projection field
        const hasRequiredLatLon = this.mappingDescriptors.some((d) => d.type === 'latLon' && d.required);
        if (hasRequiredLatLon && !this._fieldMappings['projection']) {
            isValid = false;
            errors.push('main:errors:csv:ProjectionIsMissing');
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
    protected _getCsvFieldsToMap = () => {
        const fieldsToMap: string[] = [];
        this.mappingDescriptors.forEach((descriptor) => {
            switch (descriptor.type) {
            case 'latLon':
                fieldsToMap.push(descriptor.key + 'Lat');
                fieldsToMap.push(descriptor.key + 'Lon');
                break;
            case 'routingTime':
                fieldsToMap.push(descriptor.key);
                break;
            case 'single':
                fieldsToMap.push(descriptor.key);
                break;
            }
        });
        return fieldsToMap;
    };

    protected _resetValidation(): void {
        this._isValid = undefined;
        this._errors = [];
    }

    /**
     * Set the CSV fields available for mapping
     * @param csvFields The list of CSV fields
     */
    setCsvFields(csvFields: string[]): void {
        this._csvFields = _cloneDeep(csvFields);

        // Remove mappings for fields that no longer exist
        const validMappings = _cloneDeep(this._fieldMappings);
        this._getCsvFieldsToMap().forEach((key) => {
            if (validMappings[key] !== undefined && !csvFields.includes(validMappings[key])) {
                delete validMappings[key];
            }
        });
        this._fieldMappings = validMappings;
        this._resetValidation();
    }

    /**
     * Update a single field mapping with a CSV field from the file.
     * @param fieldKey The field key to map (from the descriptor)
     * @param csvField The CSV field to map to the fieldKey
     */
    updateFieldMapping(fieldKey: string, csvField: string): void {
        (this._fieldMappings as Record<string, string>)[fieldKey] = csvField;
        this._resetValidation();
    }

    /**
     * Get a single field mapping for a key
     * @param fieldKey The field key to get the mapping for
     * @returns The field being mapped to, or `undefined` if not mapped
     */
    getFieldMapping(fieldKey: string): string | undefined {
        return this._fieldMappings[fieldKey];
    }

    /**
     * Get the current field mappings, with partial mapping allowed.
     * @returns A copy of the current field mappings
     */
    getPartialFieldMappings(): Partial<T> {
        return _cloneDeep(this._fieldMappings);
    }

    /**
     * Get all field mappings. This will return a complete mapping only if the
     * object is valid, otherwise an error is thrown if the object is still
     * being filled.
     * @returns A copy of the current field mappings
     */
    getFieldMappings(): T {
        if (this.isValid() === true) {
            return _cloneDeep(this._fieldMappings) as T;
        }
        throw new Error('Cannot get field mappings: the mapping is not valid');
    }

    /**
     * Get the array of mapping descriptors
     * @returns {CsvFieldMappingDescriptor[]} The array of mapping descriptors
     */
    getMappingDescriptors(): CsvFieldMappingDescriptor[] {
        return this.mappingDescriptors;
    }

    /**
     * Get the list of CSV fields from the file
     * @returns {string[]} The list of CSV fields from the file
     */
    getCsvFields(): string[] {
        return this._csvFields;
    }

    /**
     * Get the array of error messages if the object is not valid.
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
     * @returns {boolean} True if the object is valid, false otherwise
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
}

/**
 * A class to manage both CSV field mapping and file operations.
 */
export class CsvFileAndFieldMapper<
    T extends Record<string, string> = Record<string, string>
> extends CsvFieldMapper<T> {
    private _csvFile?: FileConfig;

    constructor(mappingDescriptors: CsvFieldMappingDescriptor[], csvFileAndMapping?: CsvFileAndMapping<T> | undefined) {
        super(mappingDescriptors, csvFileAndMapping?.csvFields, csvFileAndMapping?.fileAndMapping.fieldMappings);
        if (csvFileAndMapping) {
            this._csvFile = csvFileAndMapping.fileAndMapping.csvFile;
        }
    }

    protected _validate(): { isValid: boolean; errors: ErrorMessage[] } {
        let isValid = true;
        const errors: ErrorMessage[] = [];

        if (!this._csvFile) {
            isValid = false;
            errors.push('main:errors:csv:NoFileSelected');
            return { isValid, errors };
        }

        // Call parent validation
        const parentValidation = super._validate();
        return parentValidation;
    }

    private async _processCsv(file: string | File | NodeJS.ReadableStream, fileConfig: FileConfig): Promise<string[]> {
        // Get the attribute from the file's first row
        let csvFileAttributes: string[] = [];
        await parseCsvFile(file, (data) => (csvFileAttributes = Object.keys(data)), {
            header: true,
            nbRows: 1 // only get the first row to get column names
        });

        this._csvFile = fileConfig;
        this.setCsvFields(csvFileAttributes);
        return this._csvFields;
    }

    /**
     * Set the CSV file from a file that will be uploaded to the server. This
     * function will read the first line of the file to get the CSV fields and
     * reset the current field mappings for any unexisting field.
     * @param file The uploaded file or its name
     * @param uploadFilename {string} The name to use when uploading the file,
     * which can be different from the actual file name
     * @returns The list of CSV fields found in the file
     */
    async setCsvFileFromUpload(file: string | File, uploadFilename: string): Promise<string[]> {
        const fileConfig: FileConfig = {
            location: 'upload',
            filename: typeof file === 'string' ? file : file.name,
            uploadFilename
        };
        return this._processCsv(file, fileConfig);
    }

    /**
     * Set the CSV file from stream, with the file location specified as second
     * parameter. This function will read the first line of the file to get the
     * CSV fields and reset the current field mappings for any unexisting field.
     * @param file The uploaded file or its name
     * @param fileConfig The file configuration indicating where the file is
     * located
     * @returns The list of CSV fields found in the file
     */
    async setCsvFileFromStream(stream: string | NodeJS.ReadableStream, fileConfig: FileConfig): Promise<string[]> {
        return this._processCsv(stream, fileConfig);
    }

    /**
     * Get the current CSV file and mapping. This function will only return a
     * value when called on valid objects. During the process of filling the
     * mapping, this function may return undefined.
     * @returns {CsvFileAndMapping | undefined} The current CSV file and
     * mapping,
     */
    getCurrentFileAndMapping(): CsvFileAndMapping<T> | undefined {
        if (!this._csvFile || this.isValid() === false) {
            return undefined;
        }
        return {
            type: 'csv',
            fileAndMapping: {
                csvFile: _cloneDeep(this._csvFile),
                fieldMappings: this.getFieldMappings()
            },
            csvFields: this.getCsvFields()
        };
    }

    /**
     * Get the current file location configuration
     * @returns {FileConfig | undefined} The current file configuration
     */
    getFileLocation(): FileConfig | undefined {
        return _cloneDeep(this._csvFile);
    }
}
