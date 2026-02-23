/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    PropertyRegistryRecord,
    PropertyRegistryRecordAttributes
} from '../PropertyRegistryRecord';

// Sample GeoJSON geometries for testing
const sampleBuildingPolygon: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
        [
            [
                [-73.567, 45.501],
                [-73.567, 45.502],
                [-73.566, 45.502],
                [-73.566, 45.501],
                [-73.567, 45.501]
            ]
        ]
    ]
};

const sampleParcelPolygon: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
        [
            [
                [-73.568, 45.500],
                [-73.568, 45.503],
                [-73.565, 45.503],
                [-73.565, 45.500],
                [-73.568, 45.500]
            ]
        ]
    ]
};

const samplePoint: GeoJSON.Point = {
    type: 'Point',
    coordinates: [-73.5665, 45.5015]
};

describe('PropertyRegistryRecord', () => {
    describe('PropertyRegistryRecordAttributes type', () => {
        test('should accept minimal attributes with only id', () => {
            const minimalAttributes: PropertyRegistryRecordAttributes = {
                id: 1
            };
            expect(minimalAttributes.id).toBe(1);
        });

        test('should accept all attributes', () => {
            const fullAttributes: PropertyRegistryRecordAttributes = {
                id: 1,
                internalId: 'TEST-001',
                addresses: ['123 Main St', 'Apt 4'],
                geogMainBuildingPolygon: sampleBuildingPolygon,
                geogParcelPolygon: sampleParcelPolygon,
                geogMainBuildingCentroid: samplePoint,
                geogParcelCentroid: samplePoint,
                geogMainEntrancePoint: samplePoint,
                mainEntranceMaxErrorM: 100,
                numFlats: 12,
                numNonResidentialUnits: 2,
                totalFloorAreaM2: 2500,
                levels: 4,
                yearBuilt: 1985,
                buildingType: 'residential',
                assessedValueTotal: 750000.00,
                assessedValueLand: 250000.00,
                assessedValueBuilding: 500000.00,
                parcelAreaM2: 450,
                landUseCode: 'R-2',
                country: 'CA',
                region: 'Quebec',
                municipality: 'Montreal',
                borough: 'Plateau-Mont-Royal',
                lastUpdated: new Date('2026-01-01'),
                dataSourceId: '123e4567-e89b-12d3-a456-426614174000',
            };
            expect(fullAttributes.id).toBe(1);
        });
    });

    describe('Constructor', () => {
        test('should create instance with minimal attributes', () => {
            const attributes: PropertyRegistryRecordAttributes = { id: 1 };
            const propertyRegistryRecord = new PropertyRegistryRecord(attributes);
            expect(propertyRegistryRecord).toBeInstanceOf(PropertyRegistryRecord);
        });

        test('should create instance with all attributes', () => {
            const attributes: PropertyRegistryRecordAttributes = {
                id: 1,
                internalId: 'TEST-001',
                addresses: ['123 Main St'],
                geogMainBuildingPolygon: sampleBuildingPolygon,
                geogParcelPolygon: sampleParcelPolygon,
                geogMainBuildingCentroid: samplePoint,
                geogParcelCentroid: samplePoint,
                geogMainEntrancePoint: samplePoint,
                mainEntranceMaxErrorM: 100,
                numFlats: 12,
                numNonResidentialUnits: 2,
                totalFloorAreaM2: 2500,
                levels: 4,
                yearBuilt: 1985,
                buildingType: 'residential',
                assessedValueTotal: 750000.00,
                assessedValueLand: 250000.00,
                assessedValueBuilding: 500000.00,
                parcelAreaM2: 450,
                landUseCode: 'R-2',
                country: 'CA',
                region: 'Quebec',
                municipality: 'Montreal',
                borough: 'Plateau',
                lastUpdated: new Date('2025-01-01'),
                dataSourceId: '123e4567-e89b-12d3-a456-426614174000'
            };
            const propertyRegistryRecord = new PropertyRegistryRecord(attributes);
            expect(propertyRegistryRecord).toBeInstanceOf(PropertyRegistryRecord);
        });
    });

    describe('getId', () => {
        test('should return the id', () => {
            const attributes: PropertyRegistryRecordAttributes = { id: 42 };
            const propertyRegistryRecord = new PropertyRegistryRecord(attributes);
            expect(propertyRegistryRecord.getId()).toBe(42);
        });
    });

    describe('Getter properties', () => {
        const getterTestCases: Array<{
            getterName: keyof PropertyRegistryRecord;
            attributeName: keyof PropertyRegistryRecordAttributes;
            sampleValue: unknown;
        }> = [
            { getterName: 'internalId', attributeName: 'internalId', sampleValue: 'PROP-123' },
            { getterName: 'addresses', attributeName: 'addresses', sampleValue: ['123 Main St', 'Apt 4'] },
            { getterName: 'geogMainBuildingPolygon', attributeName: 'geogMainBuildingPolygon', sampleValue: sampleBuildingPolygon },
            { getterName: 'geogParcelPolygon', attributeName: 'geogParcelPolygon', sampleValue: sampleParcelPolygon },
            { getterName: 'geogMainBuildingCentroid', attributeName: 'geogMainBuildingCentroid', sampleValue: samplePoint },
            { getterName: 'geogParcelCentroid', attributeName: 'geogParcelCentroid', sampleValue: samplePoint },
            { getterName: 'geogMainEntrancePoint', attributeName: 'geogMainEntrancePoint', sampleValue: samplePoint },
            { getterName: 'mainEntranceMaxErrorM', attributeName: 'mainEntranceMaxErrorM', sampleValue: 100 },
            { getterName: 'numFlats', attributeName: 'numFlats', sampleValue: 12 },
            { getterName: 'numNonResidentialUnits', attributeName: 'numNonResidentialUnits', sampleValue: 2 },
            { getterName: 'totalFloorAreaM2', attributeName: 'totalFloorAreaM2', sampleValue: 2500 },
            { getterName: 'levels', attributeName: 'levels', sampleValue: 4 },
            { getterName: 'yearBuilt', attributeName: 'yearBuilt', sampleValue: 1985 },
            { getterName: 'buildingType', attributeName: 'buildingType', sampleValue: 'residential' },
            { getterName: 'assessedValueTotal', attributeName: 'assessedValueTotal', sampleValue: 750000.00 },
            { getterName: 'assessedValueLand', attributeName: 'assessedValueLand', sampleValue: 250000.00 },
            { getterName: 'assessedValueBuilding', attributeName: 'assessedValueBuilding', sampleValue: 500000.00 },
            { getterName: 'parcelAreaM2', attributeName: 'parcelAreaM2', sampleValue: 450 },
            { getterName: 'landUseCode', attributeName: 'landUseCode', sampleValue: 'R-2' },
            { getterName: 'country', attributeName: 'country', sampleValue: 'CA' },
            { getterName: 'region', attributeName: 'region', sampleValue: 'Quebec' },
            { getterName: 'municipality', attributeName: 'municipality', sampleValue: 'Montreal' },
            { getterName: 'borough', attributeName: 'borough', sampleValue: 'Plateau-Mont-Royal' },
            { getterName: 'lastUpdated', attributeName: 'lastUpdated', sampleValue: new Date('2026-01-01') },
            { getterName: 'dataSourceId', attributeName: 'dataSourceId', sampleValue: '123e4567-e89b-12d3-a456-426614174000' },
        ];

        test.each(getterTestCases)(
            'should return $attributeName when present for $getterName',
            ({ attributeName, getterName, sampleValue }) => {
                const attributes = { id: 1, [attributeName]: sampleValue } as PropertyRegistryRecordAttributes;
                const propertyRegistryRecord = new PropertyRegistryRecord(attributes);
                expect(propertyRegistryRecord[getterName]).toEqual(sampleValue);
            }
        );

        test.each(getterTestCases)(
            'should return undefined when $attributeName is not set for $getterName',
            ({ getterName }) => {
                const attributes: PropertyRegistryRecordAttributes = { id: 1 };
                const propertyRegistryRecord = new PropertyRegistryRecord(attributes);
                if (getterName === 'addresses') {
                    expect(propertyRegistryRecord.addresses).toEqual([]);
                } else {
                    expect(propertyRegistryRecord[getterName]).toBeUndefined();
                }
            }
        );

        test('should return empty array when addresses is empty', () => {
            const attributes: PropertyRegistryRecordAttributes = {
                id: 1,
                addresses: []
            };
            const propertyRegistryRecord = new PropertyRegistryRecord(attributes);
            expect(propertyRegistryRecord.addresses).toEqual([]);
        });
    });
});
