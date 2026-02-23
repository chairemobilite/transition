/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import { Iso3166Alpha2Code } from 'iso-3166-ts';
import { isFeatureCollection } from 'geojson-validation';

import knex from '../../../config/shared/db.config';
import dbQueries from '../propertyRegistry.db.queries';
import dataSourceDbQueries from '../dataSources.db.queries';
import { PropertyRegistryRecordAttributes } from 'chaire-lib-common/lib/services/propertyRegistry/PropertyRegistryRecord';

const objectName = 'property registry';
const dataSourceId = uuidV4();
const otherDataSourceId = uuidV4();

// Sample building polygon (small rectangle in Montreal area)
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

// Sample parcel polygon (larger rectangle containing the building)
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

// Sample points
const sampleBuildingCentroid: GeoJSON.Point = {
    type: 'Point',
    coordinates: [-73.5665, 45.5015]
};

const sampleParcelCentroid: GeoJSON.Point = {
    type: 'Point',
    coordinates: [-73.5666, 45.5016]
};

const sampleMainEntrance: GeoJSON.Point = {
    type: 'Point',
    coordinates: [-73.5668, 45.5012]
};

const newObjectAttributes: Partial<PropertyRegistryRecordAttributes> = {
    internalId: 'TEST-PROP-001',
    addresses: ['123 Main Street', 'Apt 4'],
    geogMainBuildingPolygon: sampleBuildingPolygon,
    geogParcelPolygon: sampleParcelPolygon,
    geogMainBuildingCentroid: sampleBuildingCentroid,
    geogParcelCentroid: sampleParcelCentroid,
    geogMainEntrancePoint: sampleMainEntrance,
    mainEntranceMaxErrorM: 220,
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
    country: 'CA' as Iso3166Alpha2Code,
    region: 'Quebec',
    municipality: 'Montreal',
    borough: 'Plateau-Mont-Royal',
    lastUpdated: new Date('2026-01-01'),
    dataSourceId: dataSourceId
};

const minimalObjectAttributes: Partial<PropertyRegistryRecordAttributes> = {
    internalId: 'TEST-PROP-MINIMAL',
    dataSourceId: dataSourceId
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await knex.raw('TRUNCATE TABLE tr_property_registry CASCADE');
    await knex.raw('TRUNCATE TABLE tr_data_sources CASCADE');
    await dataSourceDbQueries.create({
        id: dataSourceId,
        type: 'propertyRegistry',
        shortname: 'TestPropertyDataSource',
        name: 'Test Property Data Source',
        data: {}
    });
    await dataSourceDbQueries.create({
        id: otherDataSourceId,
        type: 'propertyRegistry',
        shortname: 'OtherPropertyDataSource',
        name: 'Other Property Data Source',
        data: {}
    });
});

afterAll(async () => {
    await knex.raw('TRUNCATE TABLE tr_property_registry CASCADE');
    await knex.raw('TRUNCATE TABLE tr_data_sources CASCADE');
    await knex.destroy();
});

describe(`${objectName}`, () => {

    describe('CRUD operations', () => {
        test('exists should return false if object is not in database', async () => {
            const exists = await dbQueries.exists(999999);
            expect(exists).toBe(false);
        });

        test('should create a new object with all attributes', async () => {
            const id = await dbQueries.create(newObjectAttributes);
            expect(id).toBeDefined();
            expect(typeof id).toBe('number');
            newObjectAttributes.id = id as number;
        });

        let attributes: PropertyRegistryRecordAttributes;
        test('should read an object from database', async () => {
            attributes = await dbQueries.read(newObjectAttributes.id!);
        });

        test.each<[string, () => unknown, unknown, 'toBe' | 'toEqual']>([
            ['internalId', () => attributes.internalId, newObjectAttributes.internalId, 'toBe'],
            ['addresses', () => attributes.addresses, newObjectAttributes.addresses, 'toEqual'],
            ['numFlats', () => attributes.numFlats, newObjectAttributes.numFlats, 'toBe'],
            ['numNonResidentialUnits', () => attributes.numNonResidentialUnits, newObjectAttributes.numNonResidentialUnits, 'toBe'],
            ['totalFloorAreaM2', () => attributes.totalFloorAreaM2, newObjectAttributes.totalFloorAreaM2, 'toBe'],
            ['levels', () => attributes.levels, newObjectAttributes.levels, 'toBe'],
            ['yearBuilt', () => attributes.yearBuilt, newObjectAttributes.yearBuilt, 'toBe'],
            ['buildingType', () => attributes.buildingType, newObjectAttributes.buildingType, 'toBe'],
            ['assessedValueTotal', () => Number(attributes.assessedValueTotal), newObjectAttributes.assessedValueTotal, 'toBe'],
            ['assessedValueLand', () => Number(attributes.assessedValueLand), newObjectAttributes.assessedValueLand, 'toBe'],
            ['assessedValueBuilding', () => Number(attributes.assessedValueBuilding), newObjectAttributes.assessedValueBuilding, 'toBe'],
            ['parcelAreaM2', () => attributes.parcelAreaM2, newObjectAttributes.parcelAreaM2, 'toBe'],
            ['landUseCode', () => attributes.landUseCode, newObjectAttributes.landUseCode, 'toBe'],
            ['country', () => attributes.country, newObjectAttributes.country, 'toBe'],
            ['region', () => attributes.region, newObjectAttributes.region, 'toBe'],
            ['municipality', () => attributes.municipality, newObjectAttributes.municipality, 'toBe'],
            ['borough', () => attributes.borough, newObjectAttributes.borough, 'toBe'],
            ['lastUpdated', () => attributes.lastUpdated?.getTime(), newObjectAttributes.lastUpdated?.getTime(), 'toBe'],
            ['dataSourceId', () => attributes.dataSourceId, newObjectAttributes.dataSourceId, 'toBe'],
        ])('should have correct %s', (fieldName, actualAccessor, expectedValue, matcher) => {
            if (matcher === 'toEqual') {
                expect(actualAccessor()).toEqual(expectedValue);
            } else {
                expect(actualAccessor()).toBe(expectedValue);
            }
        });

        test('should create a minimal object with only required attributes', async () => {
            const id = await dbQueries.create(minimalObjectAttributes);
            expect(id).toBeDefined();
            minimalObjectAttributes.id = id as number;
        });

        test('should read minimal object from database', async () => {
            const attributes = await dbQueries.read(minimalObjectAttributes.id!);
            expect(attributes.internalId).toBe(minimalObjectAttributes.internalId);
            expect(attributes.dataSourceId).toBe(minimalObjectAttributes.dataSourceId);
        });

    });


    describe('Create multiple operations', () => {
        test('create multiple with errors, it should be a transaction', async () => {
            const countBefore = Number(
                (await knex('tr_property_registry').count('* as count').first())?.count
            );

            const testProp1: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'BATCH-TEST-001',
                dataSourceId: dataSourceId
            };
            const testProp2: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'BATCH-TEST-002',
                dataSourceId: uuidV4() // Non-existent data source
            };

            let error: unknown = undefined;
            try {
                await dbQueries.createMultiple([testProp1, testProp2]);
            } catch (err) {
                error = err;
            }
            expect(error).toBeDefined();

            const countAfter = Number(
                (await knex('tr_property_registry').count('* as count').first())?.count
            );
            expect(countAfter).toBe(countBefore);
        });

        test('create multiple with success', async () => {
            const testProp1: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'BATCH-SUCCESS-001',
                dataSourceId: dataSourceId,
                numFlats: 3
            };
            const testProp2: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'BATCH-SUCCESS-002',
                dataSourceId: dataSourceId,
                numFlats: 5
            };

            const ids = await dbQueries.createMultiple([testProp1, testProp2]);
            expect(ids.length).toBe(2);

            const prop1 = await dbQueries.read(ids[0].id);
            expect(prop1.internalId).toBe('BATCH-SUCCESS-001');
            expect(prop1.numFlats).toBe(3);
            const prop2 = await dbQueries.read(ids[1].id);
            expect(prop2.internalId).toBe('BATCH-SUCCESS-002');
            expect(prop2.numFlats).toBe(5);
        });
    });


    describe('Delete operations', () => {
        test('should delete properties for data source', async () => {
            const testProp: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'DELETE-DS-TEST',
                dataSourceId: otherDataSourceId,
                geogMainEntrancePoint: sampleMainEntrance
            };
            await dbQueries.create(testProp);

            const collectionBefore = await dbQueries.pointsGeojsonCollection({ dataSourceId: otherDataSourceId });
            const initialCount = collectionBefore.features.length;
            expect(initialCount).toBeGreaterThan(0);

            const id = await dbQueries.deleteForDataSourceId(otherDataSourceId);
            expect(id).toBe(otherDataSourceId);

            const collectionAfter = await dbQueries.pointsGeojsonCollection({ dataSourceId: otherDataSourceId });
            expect(collectionAfter.features.length).toBe(0);
        });
    });

    describe('pointsGeojsonCollection', () => {
        beforeAll(async () => {
            await knex.raw('TRUNCATE TABLE tr_property_registry CASCADE');
            // Create properties with different point configurations
            await dbQueries.create({
                internalId: 'GEOJSON-MAIN-ENTRANCE',
                dataSourceId: dataSourceId,
                geogMainEntrancePoint: sampleMainEntrance,
                mainEntranceMaxErrorM: 50,
                numFlats: 10
            });
            await dbQueries.create({
                internalId: 'GEOJSON-BUILDING-CENTROID',
                dataSourceId: dataSourceId,
                geogMainBuildingCentroid: sampleBuildingCentroid,
                numFlats: 5
            });
            await dbQueries.create({
                internalId: 'GEOJSON-PARCEL-CENTROID',
                dataSourceId: dataSourceId,
                geogParcelCentroid: sampleParcelCentroid,
                numFlats: 3
            });
            await dbQueries.create({
                internalId: 'GEOJSON-NO-POINT',
                dataSourceId: dataSourceId
                // No point - should be excluded from collection
            });
        });

        test('should return a valid GeoJSON FeatureCollection', async () => {
            const collection = await dbQueries.pointsGeojsonCollection({ dataSourceId });

            expect(isFeatureCollection(collection)).toBe(true);
        });

        test('should return only properties with points (exclude null points)', async () => {
            const collection = await dbQueries.pointsGeojsonCollection({ dataSourceId });

            // Should have 3 features (excludes 'GEOJSON-NO-POINT')
            expect(collection.features.length).toBe(3);
        });

        test.each([
            ['main_entrance', { precision: 'main_entrance', main_entrance_max_error_m: 50, num_flats: 10 }],
            ['building_centroid', { precision: 'building_centroid', main_entrance_max_error_m: null, num_flats: 5 }],
            ['parcel_centroid', { precision: 'parcel_centroid', main_entrance_max_error_m: null, num_flats: 3 }]
        ])('should return correct feature for %s point type', async (precision, expectedProperties) => {
            const collection = await dbQueries.pointsGeojsonCollection({ dataSourceId });
            const feature = collection.features.find(
                (f) => f.properties.precision === precision
            );

            expect(feature).toBeDefined();
            expect(feature!.type).toBe('Feature');
            expect(feature!.id).toBeDefined();
            expect(feature!.geometry?.type).toBe('Point');
            expect(feature!.properties).toEqual(expectedProperties);
        });

        test('should filter by objectIds', async () => {
            const allCollection = await dbQueries.pointsGeojsonCollection({ dataSourceId });
            const firstTwoIds = allCollection.features.slice(0, 2).map((f) => f.id as number);

            const filteredCollection = await dbQueries.pointsGeojsonCollection({
                dataSourceId,
                propertyIds: firstTwoIds
            });

            expect(filteredCollection.features.length).toBe(2);
            expect(filteredCollection.features.map((f) => f.id)).toEqual(expect.arrayContaining(firstTwoIds));
        });

        test('should return empty collection for non-existent dataSourceId', async () => {
            const nonExistentDataSourceId = uuidV4();
            const collection = await dbQueries.pointsGeojsonCollection({
                dataSourceId: nonExistentDataSourceId
            });

            expect(collection.features.length).toBe(0);
        });

        test('should throw error when aroundPoint is provided without withRadiusMeters', async () => {
            await expect(
                dbQueries.pointsGeojsonCollection({
                    dataSourceId,
                    aroundPoint: sampleMainEntrance
                })
            ).rejects.toThrow('withRadiusMeters is required when aroundPoint is provided');
        });

        test('should return all nearby points with a large radius', async () => {
            const collection = await dbQueries.pointsGeojsonCollection({
                dataSourceId,
                aroundPoint: sampleMainEntrance,
                withRadiusMeters: 5000
            });

            expect(collection.features.length).toBe(3);
        });

        test('should include only points within radius', async () => {
            // sampleMainEntrance is at [-73.5668, 45.5012]
            // buildingCentroid is at [-73.5665, 45.5015] (~40.7 m away)
            // parcelCentroid is at [-73.5666, 45.5016] (~47.1 m away)
            // A 45 m radius includes main entrance + building centroid, excludes parcel centroid.
            const collection = await dbQueries.pointsGeojsonCollection({
                dataSourceId,
                aroundPoint: sampleMainEntrance,
                withRadiusMeters: 45
            });

            expect(collection.features.length).toBe(2);
            const precisions = collection.features.map((f) => f.properties.precision);
            expect(precisions).toEqual(expect.arrayContaining(['main_entrance', 'building_centroid']));
            expect(precisions).not.toContain('parcel_centroid');
        });

        test('should return no points when radius excludes all', async () => {
            const farAwayPoint: GeoJSON.Point = {
                type: 'Point',
                coordinates: [-80.0, 50.0]
            };
            const collection = await dbQueries.pointsGeojsonCollection({
                dataSourceId,
                aroundPoint: farAwayPoint,
                withRadiusMeters: 100
            });

            expect(collection.features.length).toBe(0);
        });
    });

    describe('readPoint', () => {
        let testPropertyId: number;

        beforeAll(async () => {
            const id = await dbQueries.create({
                internalId: 'READPOINT-TEST',
                dataSourceId: dataSourceId,
                geogMainEntrancePoint: sampleMainEntrance,
                mainEntranceMaxErrorM: 150,
                numFlats: 8
            });
            testPropertyId = id as number;
        });

        test('should return point with correct structure', async () => {
            const result = await dbQueries.readPoint(testPropertyId);

            expect(result).toBeDefined();
            expect(result.id).toBe(testPropertyId);
            expect(result.properties.precision).toBe('main_entrance');
            expect(result.properties.main_entrance_max_error_m).toBe(150);
            expect(result.properties.num_flats).toBe(8);
            expect(result.geometry.type).toBe('Point');
            expect(result.geometry.coordinates).toEqual(sampleMainEntrance.coordinates);
        });

        test('should return precision as main_entrance when main entrance exists', async () => {
            const result = await dbQueries.readPoint(testPropertyId);

            expect(result.properties.precision).toBe('main_entrance');
        });

        test('should return main_entrance_max_error_m', async () => {
            const result = await dbQueries.readPoint(testPropertyId);

            expect(result.properties.main_entrance_max_error_m).toBe(150);
        });

        test('should return num_flats', async () => {
            const result = await dbQueries.readPoint(testPropertyId);

            expect(result.properties.num_flats).toBe(8);
        });

        test('should throw error for non-existent id', async () => {
            await expect(dbQueries.readPoint(999999)).rejects.toThrow('Cannot find object');
        });

        test('should work with string id', async () => {
            const result = await dbQueries.readPoint(String(testPropertyId));

            expect(result.id).toBe(testPropertyId);
        });
    });

    describe('Geography handling', () => {
        test('should store and retrieve building polygon correctly', async () => {
            const propWithPolygon: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'POLYGON-TEST',
                dataSourceId: dataSourceId,
                geogMainBuildingPolygon: sampleBuildingPolygon
            };
            const id = await dbQueries.create(propWithPolygon);

            const retrieved = await dbQueries.read(id as string | number);
            expect(retrieved.geogMainBuildingPolygon).toBeDefined();
            expect(retrieved.geogMainBuildingPolygon?.type).toBe('MultiPolygon');
        });

        test('should store and retrieve points correctly', async () => {
            const propWithPoints: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'POINTS-TEST',
                dataSourceId: dataSourceId,
                geogMainBuildingCentroid: sampleBuildingCentroid,
                geogParcelCentroid: sampleParcelCentroid,
                geogMainEntrancePoint: sampleMainEntrance
            };
            const id = await dbQueries.create(propWithPoints);

            const retrieved = await dbQueries.read(id as string | number);
            expect(retrieved.geogMainBuildingCentroid).toBeDefined();
            expect(retrieved.geogMainBuildingCentroid?.type).toBe('Point');
            expect(retrieved.geogParcelCentroid).toBeDefined();
            expect(retrieved.geogMainEntrancePoint).toBeDefined();
        });

        test('should handle null geography values', async () => {
            const propNoGeo: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'NO-GEO-TEST',
                dataSourceId: dataSourceId
            };
            const id = await dbQueries.create(propNoGeo);

            const retrieved = await dbQueries.read(id as string | number);
            expect(retrieved.geogMainBuildingPolygon).toBeUndefined();
            expect(retrieved.geogParcelPolygon).toBeUndefined();
            expect(retrieved.geogMainBuildingCentroid).toBeUndefined();
            expect(retrieved.geogParcelCentroid).toBeUndefined();
            expect(retrieved.geogMainEntrancePoint).toBeUndefined();
        });
    });


    describe('Array fields', () => {
        test('should store and retrieve addresses array', async () => {
            const propWithAddresses: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'ADDRESSES-TEST',
                dataSourceId: dataSourceId,
                addresses: ['123 Main St', 'Unit 4B', 'Building C']
            };
            const id = await dbQueries.create(propWithAddresses);

            const retrieved = await dbQueries.read(id as string | number);
            expect(retrieved.addresses).toEqual(['123 Main St', 'Unit 4B', 'Building C']);
        });

        test('should handle empty addresses array', async () => {
            const propEmptyAddresses: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'EMPTY-ADDR-TEST',
                dataSourceId: dataSourceId,
                addresses: []
            };
            const id = await dbQueries.create(propEmptyAddresses);

            const retrieved = await dbQueries.read(id as string | number);
            expect(retrieved.addresses).toEqual([]);
        });
    });


    describe('mainEntranceMaxErrorM field', () => {
        test('should store and retrieve mainEntranceMaxErrorM', async () => {
            const propWithMaxError: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'MAX-ERROR-TEST',
                dataSourceId: dataSourceId,
                mainEntranceMaxErrorM: 123
            };
            const id = await dbQueries.create(propWithMaxError);

            const retrieved = await dbQueries.read(id as string | number);
            expect(retrieved.mainEntranceMaxErrorM).toBe(123);
        });

        test('should handle null mainEntranceMaxErrorM', async () => {
            const propNoMaxError: Partial<PropertyRegistryRecordAttributes> = {
                internalId: 'NO-MAX-ERROR-TEST',
                dataSourceId: dataSourceId
            };
            const id = await dbQueries.create(propNoMaxError);

            const retrieved = await dbQueries.read(id as string | number);
            expect(retrieved.mainEntranceMaxErrorM).toBeUndefined();
        });

    });
});
