/**
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { CsvFieldMapper, CsvFileAndFieldMapper } from '../CsvFieldMapper';
import { CsvFieldMappingDescriptor, CsvFileAndMapping } from '../types';
import { CsvFileAttributes, parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';

// Mock the parseCsvFile function
jest.mock('chaire-lib-common/lib/utils/files/CsvFile');
const mockParseCsvFile = parseCsvFile as jest.MockedFunction<typeof parseCsvFile>;

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

describe('CsvFieldMapper', () => {

    const mockExistingMapping = {
        name: 'name_col',
        email: 'email_col'
    };

    describe('constructor', () => {
        it('should initialize with empty state when no parameters provided', () => {
            const mapping = new CsvFieldMapper(mockDescriptors);

            expect(mapping.getCsvFields()).toEqual([]);
            expect(mapping.getFieldMapping('name')).toBeUndefined();
        });

        it('should initialize with provided csv fields and mappings', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, mockCsvFields, mockExistingMapping);

            expect(mapping.getCsvFields()).toEqual(mockCsvFields);
            expect(mapping.getFieldMapping('name')).toBe('name_col');
            expect(mapping.getFieldMapping('email')).toBe('email_col');
        });
    });

    describe('setCsvFields', () => {
        it('should set CSV fields and reset invalid mappings', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, [], mockExistingMapping);
            
            // Initially has mappings but no csv fields
            expect(mapping.getFieldMapping('name')).toBe('name_col');
            expect(mapping.getFieldMapping('email')).toBe('email_col');
            
            // Set csv fields that don't include 'email_col'
            mapping.setCsvFields(['name_col', 'time_col']);
            
            expect(mapping.getCsvFields()).toEqual(['name_col', 'time_col']);
            expect(mapping.getFieldMapping('name')).toBe('name_col'); // preserved
            expect(mapping.getFieldMapping('email')).toBeUndefined(); // removed
        });

        it('should reset validation state when setting new fields', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, ['name_col', 'time_col'], {
                name: 'name_col',
                time: 'time_col'
            });
            
            // First, trigger validation with initial values
            expect(mapping.isValid()).toBe(true);
            expect(mapping.getErrors()).toHaveLength(0);

            // Set fields that make mapping invalid
            mapping.setCsvFields(['name_col', 'email_col']);

            // Validation state should be reset
            expect(mapping.isValid()).toBe(false);
        });
    });

    describe('updateFieldMapping', () => {
        it('should update field mapping', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, mockCsvFields, mockExistingMapping);
            expect(mapping.getFieldMapping('name')).toBe('name_col');
            
            mapping.updateFieldMapping('name', 'time_col');
            
            expect(mapping.getFieldMapping('name')).toBe('time_col');
        });

        it('should reset validation state when updating mapping', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, mockCsvFields, mockExistingMapping);
            
            // Trigger validation
            expect(mapping.isValid()).toBe(false);
            
            mapping.updateFieldMapping('time', 'name_col');
            
            // Validation state should be reset
            expect(mapping.getErrors()).toEqual([]);
        });
    });

    describe('getFieldMapping', () => {
        it('should return undefined for unmapped field', () => {
            const mapping = new CsvFieldMapper(mockDescriptors);
            
            expect(mapping.getFieldMapping('name')).toBeUndefined();
        });

        it('should return mapped field', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, mockCsvFields, mockExistingMapping);
            
            expect(mapping.getFieldMapping('name')).toBe('name_col');
        });
    });

    describe('getFieldMappings', () => {
        it('should return copy of all field mappings', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, mockCsvFields, mockExistingMapping);
            
            const mappings = mapping.getFieldMappings();
            expect(mappings).toEqual(mockExistingMapping);
            
            // Should be a copy, not reference
            mappings.name = 'modified';
            expect(mapping.getFieldMapping('name')).toBe('name_col');
        });
    });

    describe('validation', () => {
        it('should be invalid when no CSV fields are set', () => {
            const mapping = new CsvFieldMapper(mockDescriptors);
            
            expect(mapping.isValid()).toBe(false);
            expect(mapping.getErrors()).toEqual(['main:errors:csv:NoFileSelected']);
        });

        it('should be invalid when required fields are not mapped', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, mockCsvFields);

            expect(mapping.isValid()).toBe(false);
            const errors = mapping.getErrors();
            expect(errors).toHaveLength(2); // name and time are required
            expect(errors).toContain('Name is required'); // custom error message
            expect(errors).toContainEqual({
                text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                params: { field: 'time' }
            }); // default error message
        });

        it('should be invalid when mapped field is not in CSV file', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, mockCsvFields);

            mapping.updateFieldMapping('name', 'missing_col'); // map to non-existent field

            expect(mapping.isValid()).toBe(false);
            const errors = mapping.getErrors();
            expect(errors).toContainEqual({
                text: 'main:errors:csv:FieldNotInCsvFile',
                params: { field: 'missing_col' }
            });
        });

        it('should be valid when all required fields are properly mapped', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, ['name_col', 'time_col', 'email_col']);

            mapping.updateFieldMapping('name', 'name_col');
            mapping.updateFieldMapping('time', 'time_col');

            expect(mapping.isValid()).toBe(true);
            expect(mapping.getErrors()).toEqual([]);
        });

        it('should cache validation results', () => {
            const mapping = new CsvFieldMapper(mockDescriptors, ['name_col', 'time_col', 'email_col']);

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
            const mapping = new CsvFieldMapper(mockDescriptors);
            
            expect(mapping.getMappingDescriptors()).toEqual(mockDescriptors);
        });
    });

    describe('Specific descriptor type validations', () => {
        test('time type requires mapping to time field', () => {
            const mockDescriptorWithMandatoryTime: CsvFieldMappingDescriptor[] = [
                {
                    key: 'time',
                    i18nLabel: 'Time',
                    i18nErrorLabel: 'i18nErrorLabel',
                    type: 'routingTime',
                    required: true
                }
            ];

            const mapping = new CsvFieldMapper(mockDescriptorWithMandatoryTime, ['name_col', 'time_col', 'email_col']);

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
            const finalMappings = mapping.getFieldMappings();
            expect(finalMappings).toEqual({
                time: 'time_col',
                timeType: 'arrival',
                timeFormat: 'HMM'
            });
        });

        test('latLon type requires mapping to lat and lon fields and projection', () => {
            const mockDescriptorWithMandatoryGeography: CsvFieldMappingDescriptor[] = [
                {
                    key: 'point',
                    i18nLabel: 'Point',
                    type: 'latLon',
                    required: true
                }
            ];

            const mapping = new CsvFieldMapper(mockDescriptorWithMandatoryGeography, ['lat_col', 'lon_col', 'other_col']);

            expect(mapping.isValid()).toBe(false); // not mapped yet
            expect(mapping.getErrors()).toEqual([
                'main:errors:csv:ProjectionIsMissing',
                {
                    text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                    params: { field: 'pointLat' }
                }, {
                    text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                    params: { field: 'pointLon' }
                }]); // default error messages for each field

            // Map the latitude field, should still be invalid
            mapping.updateFieldMapping('pointLat', 'lat_col');
            expect(mapping.isValid()).toBe(false); // missing longitude
            expect(mapping.getErrors()).toEqual([
                'main:errors:csv:ProjectionIsMissing',
                {
                    text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                    params: { field: 'pointLon' }
                }]); // default error messages for projection and lon

            // Add the projection, longitude still invalid
            mapping.updateFieldMapping('projection', '4384');
            expect(mapping.isValid()).toBe(false); // missing longitude
            expect(mapping.getErrors()).toEqual([
                {
                    text: 'main:errors:csv:MissingRequiredCsvFieldMapping',
                    params: { field: 'pointLon' }
                }]); // default error messages for projection and lon

            // Add the longitude field, should now be valid
            mapping.updateFieldMapping('pointLon', 'lon_col');
            expect(mapping.isValid()).toBe(true);

            // Verify final mapping
            const finalMappings = mapping.getFieldMappings();
            expect(finalMappings).toEqual({
                projection: '4384',
                pointLat: 'lat_col',
                pointLon: 'lon_col'
            });
        });
    });
});

describe('CsvFileAndFieldMapper', () => {
    const uploadFilename = 'testUpload.csv';

    const mockExistingMapping: CsvFileAndMapping = {
        type: 'csv',
        fileAndMapping: {
            csvFile: { location: 'upload', filename: 'test.csv', uploadFilename },
            fieldMappings: {
                name: 'name_col',
                time: 'time_col'
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
            const mapping = new CsvFileAndFieldMapper(mockDescriptors);

            expect(mapping.getCsvFields()).toEqual([]);
            expect(mapping.getFieldMapping('name')).toBeUndefined();
            expect(mapping.getCurrentFileAndMapping()).toBeUndefined();
        });

        it('should initialize with existing mapping when provided', () => {
            const mapping = new CsvFileAndFieldMapper(mockDescriptors, mockExistingMapping);

            expect(mapping.getCsvFields()).toEqual(mockCsvFields);
            expect(mapping.getFieldMapping('name')).toBe('name_col');
            expect(mapping.getFieldMapping('time')).toBe('time_col');
            expect(mapping.getFieldMapping('email')).toBeUndefined();
            expect(mapping.getCurrentFileAndMapping()).toEqual(mockExistingMapping);
        });
    });

    describe('validation', () => {
        it('should be invalid when no CSV file is set', () => {
            const mapping = new CsvFileAndFieldMapper(mockDescriptors);

            expect(mapping.isValid()).toBe(false);
            expect(mapping.getErrors()).toEqual(['main:errors:csv:NoFileSelected']);
        });

        it('should be valid with existing CSV file', () => {
            const mapping = new CsvFileAndFieldMapper(mockDescriptors, mockExistingMapping);

            expect(mapping.getErrors()).toEqual([]);
            expect(mapping.isValid()).toBe(true);
        });
    })

    describe('setCsvFileFromUpload', () => {
        it('should set CSV file from upload', async () => {
            const mapping = new CsvFileAndFieldMapper(mockDescriptors);
            const mockFile = 'test.csv';
            // Set the csvObjects to simulate CSV file content
            csvObjects = { name_col: 'value', email_col: 'value' };

            const result = await mapping.setCsvFileFromUpload(mockFile, uploadFilename);

            expect(result).toEqual(['name_col', 'email_col']);
            expect(mapping.getCsvFields()).toEqual(['name_col', 'email_col']);
            expect(mapping.getCurrentFileAndMapping()?.fileAndMapping.csvFile).toEqual({
                location: 'upload',
                filename: 'test.csv',
                uploadFilename
            });
            expect(mapping.getCurrentFileAndMapping()?.fileAndMapping.fieldMappings).toEqual({});
        });

        it('should preserve valid existing mappings and remove invalid ones', async () => {
            // Initial mapping with email mapped
            const mapping = new CsvFileAndFieldMapper(mockDescriptors, mockExistingMapping);
            mapping.updateFieldMapping('email', 'email_col');
            expect(mapping.getFieldMapping('email')).toEqual('email_col');
            const mockFile = 'new.csv';

            // Set the csvObjects with new columns and some missing from original
            const newCsvContent = { name_col: 'value', time_col: 'value' };
            csvObjects = newCsvContent;

            const result = await mapping.setCsvFileFromUpload(mockFile, uploadFilename);

            expect(result).toEqual(Object.keys(newCsvContent));
            expect(mapping.getCsvFields()).toEqual(Object.keys(newCsvContent));
            expect(mapping.getFieldMapping('name')).toBe('name_col'); // preserved
            expect(mapping.getFieldMapping('email')).toBeUndefined(); // removed
        });

        it('should reset validation state when setting new file', async () => {
            const existingValidMapping: CsvFileAndMapping = {
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv', uploadFilename },
                    fieldMappings: {
                        name: 'name_col',
                        time: 'time_col'
                    }
                },
                csvFields: ['name_col', 'time_col']
            };

            const mapping = new CsvFileAndFieldMapper(mockDescriptors, existingValidMapping);
            
            // First, trigger validation with initial values
            expect(mapping.isValid()).toBe(true);
            expect(mapping.getErrors()).toHaveLength(0);

            // Set the csvObjects with new columns and some missing from original, so that result is invalid
            const newCsvContent = { name_col: 'value', email_col: 'value' };
            csvObjects = newCsvContent;
            await mapping.setCsvFileFromUpload('test.csv', uploadFilename);

            // Validation state should be reset
            expect(mapping.isValid()).toBe(false);
        });
    });

    describe('setCsvFileFromStream', () => {        
        it('should set CSV file with job location', async () => {
            const mapping = new CsvFileAndFieldMapper(mockDescriptors);
            const mockFile = 'test.csv';
            const jobId = 123;

            const result = await mapping.setCsvFileFromStream(mockFile, { location: 'job', jobId, fileKey: 'input' });

            expect(result).toEqual(['name_col', 'email_col']);
            expect(mapping.getCurrentFileAndMapping()?.fileAndMapping.csvFile).toEqual({
                location: 'job',
                jobId,
                fileKey: 'input'
            });
        });
    });

    describe('getCurrentFileAndMapping', () => {
        it('should return undefined when no file is set', () => {
            const mapping = new CsvFileAndFieldMapper(mockDescriptors);
            
            expect(mapping.getCurrentFileAndMapping()).toBeUndefined();
        });

        it('should return current file and mapping when file is set', async () => {
            const mapping = new CsvFileAndFieldMapper(mockDescriptors);
            const expectedFields = ['name_col', 'email_col'];

            await mapping.setCsvFileFromUpload('test.csv', uploadFilename);
            mapping.updateFieldMapping('name', 'name_col');

            const result = mapping.getCurrentFileAndMapping();

            expect(result).toEqual({
                type: 'csv',
                fileAndMapping: {
                    csvFile: { location: 'upload', filename: 'test.csv', uploadFilename },
                    fieldMappings: { name: 'name_col' }
                },
                csvFields: expectedFields
            });
        });
    });
});
