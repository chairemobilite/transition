/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render } from '@testing-library/react';
import GenericCsvImportAndMappingForm from '../GenericCsvImportAndMappingForm';
import { CsvFieldMappingDescriptor, CsvFileAndMapping, CsvFileAndFieldMapper } from 'transition-common/lib/services/csv';

// Mock the dependencies
jest.mock('chaire-lib-frontend/lib/components/input/FileUploaderHook', () => ({
    useFileUploader: () => ({
        upload: jest.fn(),
        uploadStatus: { status: 'notUploaded' },
        resetFileUpload: jest.fn()
    })
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

const mockOnComplete = jest.fn();
const mockOnFileReset = jest.fn();

const mockMappingDescriptor: CsvFieldMappingDescriptor[] = [
    {
        key: 'name',
        i18nLabel: 'Name',
        required: true,
        type: 'single'
    }, {
        key: 'email',
        i18nLabel: 'Email',
        required: false,
        type: 'single'
    },
];

const mockCsvFileAndMapping: CsvFileAndMapping = {
    type: 'csv',
    fileAndMapping: {
        csvFile: {
            location: 'upload',
            filename: 'test.csv',
            uploadFilename: 'testUpload.csv'
        },
        fieldMappings: {
            name: 'name_column',
            email: 'email_column'
        }
    },
    csvFields: ['name_column', 'email_column', 'age_column']
};

describe('GenericCsvImportAndMappingForm rendering', () => {
    beforeEach(() => {
        mockOnComplete.mockClear();
        mockOnFileReset.mockClear();
    });

    test('No file data', () => {
        const fileMapping = new CsvFileAndFieldMapper(mockMappingDescriptor);
        const { container } = render(
            <GenericCsvImportAndMappingForm
                csvFieldMapper={fileMapping}
                onUpdate={mockOnComplete}
                importFileName="test_import.csv"
            />
        );
        expect(container).toMatchSnapshot();
    });

    test('With current file and mapping', () => {
        const fileMapping = new CsvFileAndFieldMapper(mockMappingDescriptor, mockCsvFileAndMapping);
        const { container } = render(
            <GenericCsvImportAndMappingForm
                csvFieldMapper={fileMapping}
                onUpdate={mockOnComplete}
                importFileName="test_import.csv"
            />
        );
        expect(container).toMatchSnapshot();
    });

    test('With latLon mapping descriptor', () => {
        const descriptorWithGeography: CsvFieldMappingDescriptor[] = [
            {
                key: 'geography',
                i18nLabel: 'geographyLabel',
                required: false,
                type: 'latLon'
            },
        ];
        const fileMapping = new CsvFileAndFieldMapper(descriptorWithGeography, mockCsvFileAndMapping);

        const { container } = render(
            <GenericCsvImportAndMappingForm
                csvFieldMapper={fileMapping}
                onUpdate={mockOnComplete}
                importFileName="test_import.csv"
            />
        );
        expect(container).toMatchSnapshot();
    });

    test('With time mapping descriptor', () => {
        const descriptorWithTime: CsvFieldMappingDescriptor[] = [
            {
                key: 'timeAttribute',
                i18nLabel: 'timeAttribute',
                required: false,
                type: 'routingTime'
            },
        ];
        const fileMapping = new CsvFileAndFieldMapper(descriptorWithTime, mockCsvFileAndMapping);

        const { container } = render(
            <GenericCsvImportAndMappingForm
                csvFieldMapper={fileMapping}
                onUpdate={mockOnComplete}
                importFileName="test_import.csv"
            />
        );
        expect(container).toMatchSnapshot();
    }); 
});
