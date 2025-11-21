/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { TransitOdDemandFromCsv } from '../TransitOdDemandFromCsv';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { CsvFileAttributes, parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';
import { CsvFileAndMapping } from '../../csv';

jest.mock('chaire-lib-common/lib/utils/files/CsvFile', () => ({
    parseCsvFile: jest.fn()
}))
const parseCsvFileMock = parseCsvFile as jest.MockedFunction<typeof parseCsvFile>;

const collectionManager = new CollectionManager(null);
serviceLocator.addService('collectionManager', collectionManager);

beforeEach(() => {
    parseCsvFileMock.mockClear();
});

const defaultCsvFileAndMapping: CsvFileAndMapping = {
    type: 'csv',
    fileAndMapping: {
        csvFile: { location: 'upload' as const, filename: 'trips.csv' },
        fieldMappings: {

        }
    },
    csvFields: ['trip_id', 'origin_latitude', 'origin_longitude', 'dest_latitude', 'dest_longitude', 'trip_time']
    
};

// TransitOdDemandFromCsv.test.ts
describe('TransitOdDemandFromCsv', () => {
    
    describe('Constructor', () => {
        test('should create instance without parameters', () => {
            const demand = new TransitOdDemandFromCsv();
            expect(demand).toBeInstanceOf(TransitOdDemandFromCsv);
            expect(demand.getMappingDescriptors()).toEqual([
                { key: 'id', i18nLabel: 'transit:transitRouting:IdField', i18nErrorLabel: 'transit:transitRouting:IdFieldIsMissing', type: 'single', required: true },
                {
                    key: 'origin',
                    type: 'latLon',
                    i18nLabel: 'transit:transitRouting:OriginFieldMapping',
                    i18nErrorLabel: 'transit:transitRouting:errors:OriginIsMissing',
                    required: true
                },
                {
                    key: 'destination',
                    type: 'latLon',
                    i18nLabel: 'transit:transitRouting:DestinationFieldMapping',
                    i18nErrorLabel: 'transit:transitRouting:errors:DestinationIsMissing',
                    required: true
                },
                { key: 'time', type: 'time', i18nLabel: 'transit:transitRouting:TimeFieldMapping', i18nErrorLabel: 'transit:transitRouting:errors:TimeFieldDepartureOrArrivalIsMissing', required: true }
            ]);
        });
        
        test('should create instance with csvFileAndMapping parameter', () => {
            const demand = new TransitOdDemandFromCsv(defaultCsvFileAndMapping);
            expect(demand).toBeInstanceOf(TransitOdDemandFromCsv);
            expect(demand.getCurrentFileAndMapping()).toEqual(defaultCsvFileAndMapping);
        });
    });
    
    describe('Transit-Specific Validation', () => {
        let demand: TransitOdDemandFromCsv;
        
        beforeEach(() => {
            demand = new TransitOdDemandFromCsv(_cloneDeep(defaultCsvFileAndMapping));
        });
        
        test('should validate complete transit demand mapping', () => {
            demand.updateFieldMapping('id', 'trip_id');
            demand.updateFieldMapping('originLat', 'origin_latitude');
            demand.updateFieldMapping('originLon', 'origin_longitude');
            demand.updateFieldMapping('destinationLat', 'dest_latitude');
            demand.updateFieldMapping('destinationLon', 'dest_longitude');
            demand.updateFieldMapping('time', 'trip_time');
            demand.updateFieldMapping('timeType', 'departure');
            demand.updateFieldMapping('timeFormat', 'HH:MM');
            
            expect(demand.getErrors()).toEqual([]);
            expect(demand.isValid()).toBe(true);
            expect(demand.getCurrentFileAndMapping()?.fileAndMapping.fieldMappings).toEqual({
                id: 'trip_id',
                originLat: 'origin_latitude',
                originLon: 'origin_longitude',
                destinationLat: 'dest_latitude',
                destinationLon: 'dest_longitude',
                time: 'trip_time',
                timeType: 'departure',
                timeFormat: 'HH:MM'
            });
        });
        
        test('should fail validation when origin coordinates are missing', () => {
            demand.updateFieldMapping('id', 'trip_id');
            demand.updateFieldMapping('destinationLat', 'dest_latitude');
            demand.updateFieldMapping('destinationLon', 'dest_longitude');
            demand.updateFieldMapping('time', 'trip_time');
            demand.updateFieldMapping('timeType', 'departure');
            demand.updateFieldMapping('timeFormat', 'HH:MM');
            
            expect(demand.isValid()).toBe(false);
            const errors = demand.getErrors();
            expect(errors).toContain('transit:transitRouting:errors:OriginIsMissingLat');
            expect(errors).toContain('transit:transitRouting:errors:OriginIsMissingLon');
            expect(errors.length).toEqual(2);
            expect(demand.getCurrentFileAndMapping()?.fileAndMapping.fieldMappings).toEqual({
                id: 'trip_id',
                destinationLat: 'dest_latitude',
                destinationLon: 'dest_longitude',
                time: 'trip_time',
                timeType: 'departure',
                timeFormat: 'HH:MM'
            });
        });
        
        test('should fail validation when destination coordinates are missing', () => {
            demand.updateFieldMapping('id', 'trip_id');
            demand.updateFieldMapping('originLat', 'origin_latitude');
            demand.updateFieldMapping('originLon', 'origin_longitude');
            demand.updateFieldMapping('time', 'trip_time');
            demand.updateFieldMapping('timeType', 'departure');
            demand.updateFieldMapping('timeFormat', 'HH:MM');
            
            expect(demand.isValid()).toBe(false);
            const errors = demand.getErrors();
            expect(errors).toContain('transit:transitRouting:errors:DestinationIsMissingLat');
            expect(errors).toContain('transit:transitRouting:errors:DestinationIsMissingLon');
            expect(errors.length).toEqual(2);
            expect(demand.getCurrentFileAndMapping()?.fileAndMapping.fieldMappings).toEqual({
                id: 'trip_id',
                originLat: 'origin_latitude',
                originLon: 'origin_longitude',
                time: 'trip_time',
                timeType: 'departure',
                timeFormat: 'HH:MM'
            });
        });
        
        test('should fail validation when time attribute is missing', () => {
            demand.updateFieldMapping('id', 'trip_id');
            demand.updateFieldMapping('originLat', 'origin_latitude');
            demand.updateFieldMapping('originLon', 'origin_longitude');
            demand.updateFieldMapping('destinationLat', 'dest_latitude');
            demand.updateFieldMapping('destinationLon', 'dest_longitude');
            
            expect(demand.isValid()).toBe(false);
            const errors = demand.getErrors();
            expect(errors).toContain('transit:transitRouting:errors:TimeFieldDepartureOrArrivalIsMissing');
            expect(errors).toContain('transit:transitRouting:errors:TimeFieldDepartureOrArrivalIsMissingType');
            expect(errors).toContain('transit:transitRouting:errors:TimeFieldDepartureOrArrivalIsMissingFormat');
            expect(errors.length).toEqual(3);
            expect(demand.getCurrentFileAndMapping()?.fileAndMapping.fieldMappings).toEqual({
                id: 'trip_id',
                originLat: 'origin_latitude',
                originLon: 'origin_longitude',
                destinationLat: 'dest_latitude',
                destinationLon: 'dest_longitude',
            });
        });
    });
    
});