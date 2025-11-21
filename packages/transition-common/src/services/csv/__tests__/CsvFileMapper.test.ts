/**
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { CsvFileMapper } from '../CsvFileMapper';
import { CsvFieldMappingDescriptor, CsvFileAndMapping } from '../types';
import { CsvFileAttributes, parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';

// Mock the parseCsvFile function
jest.mock('chaire-lib-common/lib/utils/files/CsvFile');
const mockParseCsvFile = parseCsvFile as jest.MockedFunction<typeof parseCsvFile>;

describe('CsvFileMapper', () => {
    const mockDescriptors: CsvFieldMappingDescriptor[] = [
        {
            key: 'name',
            i18nLabel: 'Name',
            i18nErrorLabel: 'Name is required',
            type: 'single',
            required: true
        },
        {
            key: 'email',
            i18nLabel: 'Email',
            type: 'single',
            required: false
        },
        {
            key: 'time',
            i18nLabel: 'Time',
            type: 'single',
            required: true
        },
        {
            key: 'location',
            i18nLabel: 'Location',
            type: 'latLon',
            required: false
        }
    ];

    const mockCsvFields = ['name_col', 'email_col', 'time_col', 'lat_col', 'lon_col'];

    const mockExistingMapping: CsvFileAndMapping = {
        type: 'csv',
        fileAndMapping: {
            csvFile: { location: 'upload', filename: 'test.csv' },
            fieldMappings: {
                name: 'name_col',
                email: 'email_col'
            }
        },
        csvFields: mockCsvFields
    };

    // csvObject to send to the row callback for the test.
    let csvObjects: { [key: string]: string } = { name_col: 'value', email_col: 'value' };
    mockParseCsvFile.mockImplementation((_input: string | NodeJS.ReadableStream | any,
        rowCallback: (object: { [key: string]: any }, rowNumber: number) => void,
        _options: Partial<CsvFileAttributes>) => {
            return new Promise((resolve, reject) => {
                rowCallback(csvObjects, 1);
                resolve('completed');
            });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        csvObjects = { name_col: 'value', email_col: 'value' };
    });

    describe('constructor', () => {
        it('should initialize with empty state when no existing mapping provided', () => {
            const mapping = new CsvFileMapper(mockDescriptors);

            expect(mapping.getCsvFields()).toEqual([]);
            expect(mapping.getFieldMapping('name')).toBeUndefined();
            expect(mapping.getCurrentFileAndMapping()).toBeUndefined();
        });

        it('should initialize with existing mapping when provided', () => {
            const mapping = new CsvFileMapper(mockDescriptors, mockExistingMapping);

            expect(mapping.getCsvFields()).toEqual(mockCsvFields);
            expect(mapping.getFieldMapping('name')).toBe('name_col');
            expect(mapping.getFieldMapping('email')).toBe('email_col');
            expect(mapping.getCurrentFileAndMapping()).toEqual(mockExistingMapping);
        });
    });

    describe('setCsvFile', () => {
        it('should set CSV file with upload location', async () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            const mockFile = 'test.csv';
            // Set the csvObjects to simulate CSV file content
            csvObjects = { name_col: 'value', email_col: 'value' };

            const result = await mapping.setCsvFile(mockFile, { location: 'upload' });

            expect(result).toEqual(['name_col', 'email_col']);
            expect(mapping.getCsvFields()).toEqual(['name_col', 'email_col']);
            expect(mapping.getCurrentFileAndMapping()?.fileAndMapping.csvFile).toEqual({
                location: 'upload',
                filename: 'test.csv'
            });
            expect(mapping.getCurrentFileAndMapping()?.fileAndMapping.fieldMappings).toEqual({});
        });

        it('should set CSV file with server location', async () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            const mockFile = 'test.csv';
            const jobId = 123;

            const result = await mapping.setCsvFile(mockFile, { location: 'job', jobId, fileKey: 'input' });

            expect(result).toEqual(['name_col', 'email_col']);
            expect(mapping.getCurrentFileAndMapping()?.fileAndMapping.csvFile).toEqual({
                location: 'job',
                jobId,
                fileKey: 'input'
            });
        });

        it('should preserve valid existing mappings and remove invalid ones', async () => {
            const mapping = new CsvFileMapper(mockDescriptors, mockExistingMapping);
            const mockFile = 'new.csv';
            // Set the csvObjects with new columns and some missing from original
            const newCsvContent = { name_col: 'value', time_col: 'value' };
            csvObjects = newCsvContent;

            const result = await mapping.setCsvFile(mockFile, { location: 'upload' });

            expect(result).toEqual(Object.keys(newCsvContent));
            expect(mapping.getCsvFields()).toEqual(Object.keys(newCsvContent));
            expect(mapping.getFieldMapping('name')).toBe('name_col'); // preserved
            expect(mapping.getFieldMapping('email')).toBeUndefined(); // removed
        });

        it('should reset validation state when setting new file', async () => {
            const existingValidMapping: CsvFileAndMapping = {
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv' },
                    fieldMappings: {
                        name: 'name_col',
                        time: 'time_col'
                    }
                },
                csvFields: ['name_col', 'time_col']
            };

            const mapping = new CsvFileMapper(mockDescriptors, existingValidMapping);
            
            // First, trigger validation with no file
            expect(mapping.isValid()).toBe(true);
            expect(mapping.getErrors()).toHaveLength(0);

            // Set the csvObjects with new columns and some missing from original, so that result is invalid
            const newCsvContent = { name_col: 'value', email_col: 'value' };
            csvObjects = newCsvContent;
            await mapping.setCsvFile('test.csv', { location: 'upload' });

            // Validation state should be reset
            expect(mapping.isValid()).toBe(false);
        });
    });

    describe('updateFieldMapping', () => {
        it('should update field mapping', () => {
            const mapping = new CsvFileMapper(mockDescriptors, mockExistingMapping);
            expect(mapping.getFieldMapping('name')).toBe('name_col');
            
            mapping.updateFieldMapping('name', 'time_col');
            
            expect(mapping.getFieldMapping('name')).toBe('time_col');
        });

        it('should reset validation state when updating mapping', () => {
            const mapping = new CsvFileMapper(mockDescriptors, mockExistingMapping);
            
            // Trigger validation
            expect(mapping.isValid()).toBe(false);
            
            mapping.updateFieldMapping('time', 'name_col');
            
            // Validation state should be reset
            expect(mapping.getErrors()).toEqual([]);
        });
    });

    describe('getFieldMapping', () => {
        it('should return undefined for unmapped field', () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            
            expect(mapping.getFieldMapping('name')).toBeUndefined();
        });

        it('should return mapped field', () => {
            const mapping = new CsvFileMapper(mockDescriptors, mockExistingMapping);
            
            expect(mapping.getFieldMapping('name')).toBe('name_col');
        });
    });

    describe('validation', () => {
        it('should be invalid when no CSV file is set', () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            
            expect(mapping.isValid()).toBe(false);
            expect(mapping.getErrors()).toEqual(['csv:errors:NoFileSelected']);
        });

        it('should be invalid when required fields are not mapped', async () => {
            const mapping = new CsvFileMapper(mockDescriptors);

            await mapping.setCsvFile('test.csv', { location: 'upload' });

            expect(mapping.isValid()).toBe(false);
            const errors = mapping.getErrors();
            expect(errors).toHaveLength(2); // name and time are required
            expect(errors).toContain('Name is required'); // custom error message
            expect(errors).toContainEqual({
                text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                params: { field: 'time' }
            }); // default error message
        });

        it('should be invalid when mapped field is not in CSV file', async () => {
            const mapping = new CsvFileMapper(mockDescriptors);

            await mapping.setCsvFile('test.csv', { location: 'upload' });
            mapping.updateFieldMapping('name', 'missing_col'); // map to non-existent field

            expect(mapping.isValid()).toBe(false);
            const errors = mapping.getErrors();
            expect(errors).toContainEqual({
                text: 'main:errors:csv:FieldNotInCsvFile',
                params: { field: 'missing_col' }
            });
        });

        it('should be valid when all required fields are properly mapped', async () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            // Set the csvObjects with new columns and some missing from original
            const newCsvContent = { name_col: 'value', time_col: 'value', email_col: 'value' };
            csvObjects = newCsvContent;

            await mapping.setCsvFile('test.csv', { location: 'upload' });
            mapping.updateFieldMapping('name', 'name_col');
            mapping.updateFieldMapping('time', 'time_col');

            expect(mapping.isValid()).toBe(true);
            expect(mapping.getErrors()).toEqual([]);
        });

        it('should cache validation results', async () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            // Set the csvObjects with new columns and some missing from original
            const newCsvContent = { name_col: 'value', time_col: 'value', email_col: 'value' };
            csvObjects = newCsvContent;

            await mapping.setCsvFile('test.csv', { location: 'upload' });
            mapping.updateFieldMapping('name', 'name_col');
            mapping.updateFieldMapping('time', 'time_col');

            // First call should trigger validation
            const isValid1 = mapping.isValid();
            const errors1 = mapping.getErrors();

            // Second call should use cached results
            const isValid2 = mapping.isValid();
            const errors2 = mapping.getErrors();

            expect(isValid1).toBe(isValid2);
            expect(errors1).toEqual(errors2);
        });
    });

    describe('getMappingDescriptors', () => {
        it('should return the mapping descriptors', () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            
            expect(mapping.getMappingDescriptors()).toEqual(mockDescriptors);
        });
    });

    describe('getCurrentFileAndMapping', () => {
        it('should return undefined when no file is set', () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            
            expect(mapping.getCurrentFileAndMapping()).toBeUndefined();
        });

        it('should return current file and mapping when file is set', async () => {
            const mapping = new CsvFileMapper(mockDescriptors);
            const expectedFields = ['name_col', 'email_col'];

            await mapping.setCsvFile('test.csv', { location: 'upload' });
            mapping.updateFieldMapping('name', 'name_col');

            const result = mapping.getCurrentFileAndMapping();

            expect(result).toEqual({
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv' },
                    fieldMappings: { name: 'name_col' }
                },
                csvFields: expectedFields
            });
        });
    });

    describe('Specific descriptor type validations', () => {
        test('time type requires mapping to time field', async () => {
            const mockDescriptorWithMandatoryTime: CsvFieldMappingDescriptor[] = [
                {
                    key: 'time',
                    i18nLabel: 'Time',
                    i18nErrorLabel: 'i18nErrorLabel',
                    type: 'time',
                    required: true
                }
            ];
            // Set the csvObjects with new columns and some missing from original
            const newCsvContent = { name_col: 'value', time_col: 'value', email_col: 'value' };
            csvObjects = newCsvContent;

            const mapping = new CsvFileMapper(mockDescriptorWithMandatoryTime);

            await mapping.setCsvFile('test.csv', { location: 'upload' });
            expect(mapping.isValid()).toBe(false); // not mapped yet
            expect(mapping.getErrors()).toEqual(['i18nErrorLabel', 'i18nErrorLabelType', 'i18nErrorLabelFormat']);

            // Map the time field, should still be invalid
            mapping.updateFieldMapping('time', 'time_col');
            expect(mapping.isValid()).toBe(false); // missing type and format
            expect(mapping.getErrors()).toEqual(['i18nErrorLabelType', 'i18nErrorLabelFormat']);

            // Add the Type field, should still be invalid
            mapping.updateFieldMapping('timeType', 'arrival');
            expect(mapping.isValid()).toBe(false); // missing format
            expect(mapping.getErrors()).toEqual(['i18nErrorLabelFormat']);

            // Add the Format field, should now be valid
            mapping.updateFieldMapping('timeFormat', 'HMM');
            expect(mapping.isValid()).toBe(true);
            
            // Verify final mapping
            const finalMapping = mapping.getCurrentFileAndMapping();
            expect(finalMapping).toEqual({
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv' },
                    fieldMappings: {
                        time: 'time_col',
                        timeType: 'arrival',
                        timeFormat: 'HMM'
                    }
                },
                csvFields: Object.keys(newCsvContent)
            });
        });

        test('latLon type requires mapping to lat and lon fields', async () => {
            const mockDescriptorWithMandatoryGeography: CsvFieldMappingDescriptor[] = [
                {
                    key: 'point',
                    i18nLabel: 'Point',
                    type: 'latLon',
                    required: true
                }
            ];
            // Set the csvObjects with new columns and some missing from original
            const newCsvContent = { lat_col: 'value', lon_col: 'value', other_col: 'value' };
            csvObjects = newCsvContent;

            const mapping = new CsvFileMapper(mockDescriptorWithMandatoryGeography);

            await mapping.setCsvFile('test.csv', { location: 'upload' });
            expect(mapping.isValid()).toBe(false); // not mapped yet
            expect(mapping.getErrors()).toEqual([{
                text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                params: { field: 'pointLat' }
            }, {
                text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                params: { field: 'pointLon' }
            }]); // default error messages for each field

            // Map the latitude field, should be invalid
            mapping.updateFieldMapping('pointLat', 'lat_col');
            expect(mapping.isValid()).toBe(false); // missing longitude
            expect(mapping.getErrors()).toEqual([{
                text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                params: { field: 'pointLon' }
            }]); // default error messages for each field

            // Add the longitude field, should now be valid
            mapping.updateFieldMapping('pointLon', 'lon_col');
            expect(mapping.isValid()).toBe(true);
            
            // Verify final mapping
            const finalMapping = mapping.getCurrentFileAndMapping();
            expect(finalMapping).toEqual({
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv' },
                    fieldMappings: {
                        pointLat: 'lat_col',
                        pointLon: 'lon_col'
                    }
                },
                csvFields: Object.keys(newCsvContent)
            });
        });
    });

    describe('Specific descriptor type resetting fields', () => {
        test('time type should not overwrite type and format', async () => {
            const mockDescriptorWithTime: CsvFieldMappingDescriptor[] = [
                {
                    key: 'time',
                    i18nLabel: 'Time',
                    i18nErrorLabel: 'i18nErrorLabel',
                    type: 'time'
                }
            ];
            // Create a mapping with current values for all time fields
            const mockExistingMapping: CsvFileAndMapping = {
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv' },
                    fieldMappings: {
                        time: 'time_col',
                        timeType: 'arrival',
                        timeFormat: 'HMM'
                    }
                },
                csvFields: mockCsvFields
            };
            // Set the csvObjects with new columns and some missing from original
            const newCsvContent = { time_col: 'value', other_col: 'value' };
            csvObjects = newCsvContent;

            const mapping = new CsvFileMapper(mockDescriptorWithTime, mockExistingMapping);

            await mapping.setCsvFile('test.csv', { location: 'upload' });
            
            // Mapping should be the same as previous
            const finalMapping = mapping.getCurrentFileAndMapping();
            expect(finalMapping).toEqual({
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv' },
                    fieldMappings: {
                        time: 'time_col',
                        timeType: 'arrival',
                        timeFormat: 'HMM'
                    }
                },
                csvFields: Object.keys(newCsvContent)
            });
        });

        test('projection should not be reset', async () => {
            const mockDescriptorWithMandatoryGeography: CsvFieldMappingDescriptor[] = [
                {
                    key: 'point',
                    i18nLabel: 'Point',
                    type: 'latLon',
                    required: true
                }
            ];
            // Create a mapping with current values for all time fields
            const mockExistingMapping: CsvFileAndMapping = {
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv' },
                    fieldMappings: {
                        projection: '4854'
                    }
                },
                csvFields: mockCsvFields
            };
            // Set the csvObjects with new columns and some missing from original
            const newCsvContent = { lat_col: 'value', lon_col: 'value', other_col: 'value' };
            csvObjects = newCsvContent;

            const mapping = new CsvFileMapper(mockDescriptorWithMandatoryGeography, mockExistingMapping);

            await mapping.setCsvFile('test.csv', { location: 'upload' });
            // Mapping should be the same as previous
            const finalMapping = mapping.getCurrentFileAndMapping();
            expect(finalMapping).toEqual({
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv' },
                    fieldMappings: {
                        projection: '4854'
                    }
                },
                csvFields: Object.keys(newCsvContent)
            });
        });
    });
});
