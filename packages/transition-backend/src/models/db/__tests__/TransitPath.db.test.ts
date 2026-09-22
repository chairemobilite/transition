/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import { lineString as turfLineString } from '@turf/helpers';

import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import dbQueries from '../transitPaths.db.queries';
import linesDbQueries from '../transitLines.db.queries';
import scenariosDbQueries from '../transitScenarios.db.queries';
import schedulesDbQueries from '../transitSchedules.db.queries';
import servicesDbQueries from '../transitServices.db.queries';
import agencyDbQueries from '../transitAgencies.db.queries'
import GeojsonCollection from 'transition-common/lib/services/path/PathCollection';
import ObjectClass from 'transition-common/lib/services/path/Path';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const objectName = 'path';
const agencyId = uuidV4();
const lineId = uuidV4();
const serviceId = uuidV4();
const scenarioId = uuidV4();

const newObjectAttributes = {
    id          : uuidV4(),
    internal_id : 'InternalId test 1',
    is_frozen   : false,
    is_enabled  : true,
    line_id     : lineId,
    name        : 'South',
    direction   : 'outbound',
    description : null,
    integer_id  : 1,
    geography   : turfLineString([[-73.6, 45.5], [-73.5, 45.6], [-73.5, 45.4]]).geometry,
    nodes       : [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    stops       : [],
    segments    : [0, 23, 45, 65, 78],
    data        : {
        defaultAcceleration: 1.0,
        defaultDeceleration: 1.0,
        defaultRunningSpeedKmH: 20,
        maxRunningSpeedKmH: 100,
        routingEngine: 'engine',
        routingMode: 'bus',
        foo: 'bar',
        bar: 'foo',
        nodeTypes: [
            "engine",
            "engine",
            "engine",
            "engine",
            "engine",
            "engine"
        ]
    }
};

const newObjectAttributes2 = {
    id          : uuidV4(),
    internal_id : 'InternalId test 2',
    is_frozen   : false,
    is_enabled  : true,
    line_id     : lineId,
    name        : 'North',
    direction   : 'inbound',
    description : "Description path 2",
    integer_id  : 2,
    geography   : turfLineString([[-73.5, 45.4], [-73.6, 45.5], [-73.7, 45.3]]).geometry,
    nodes       : [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    stops       : [],
    segments    : [0, 11, 12, 55],
    data        : {
        defaultAcceleration: 1.5,
        defaultDeceleration: 1.5,
        defaultRunningSpeedKmH: 50,
        maxRunningSpeedKmH: 100,
        routingEngine: 'engine',
        routingMode: 'tram',
        foo2: 'bar2',
        bar2: 'foo2',
        nodeTypes: [
        "manual",
        "engine",
        "manual",
        "engine",
        "manual"
        ]
    }
};

const updatedAttributes = {
    name        : 'West',
    description : 'Changed description'
};

beforeAll(async () => {
    await dbQueries.truncate();
    await agencyDbQueries.create({
        id: agencyId,
        name: 'test',
        acronym: 'test'
    } as any);
    await linesDbQueries.create({
        id: lineId,
        agency_id: agencyId,
        color: '#ffffff',
    } as any);
    await servicesDbQueries.create({
        id: serviceId
    } as any);
    await scenariosDbQueries.create({
        id: scenarioId,
        services: [serviceId]
    } as any);
});

afterAll(async () => {
    await schedulesDbQueries.truncateSchedules();
    await schedulesDbQueries.truncateSchedulePeriods();
    await schedulesDbQueries.truncateScheduleTrips();
    await servicesDbQueries.truncate();
    await scenariosDbQueries.truncate();
    await dbQueries.truncate();
    await linesDbQueries.truncate();
    await agencyDbQueries.truncate();
    await knex.destroy();
});

describe(`${objectName}`, function() {

    test('exists should return false if object is not in database', async () => {

        const exists = await dbQueries.exists(uuidV4())
        expect(exists).toBe(false);

    });

    test('should create a new object in database', async () => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read a new object in database', async () => {

        const newObject = new ObjectClass(newObjectAttributes, false);

        const attributes = await dbQueries.read(newObjectAttributes.id);
        delete attributes.updated_at;
        delete attributes.created_at;
        //delete attributes.agency_id;
        delete attributes.color;
        delete attributes.data.variables;
        const _newObjectAttributes = newObject.attributes;
        delete _newObjectAttributes.color;
        delete _newObjectAttributes.data.variables;
        expect(attributes).toEqual(_newObjectAttributes);

    });

    test('should update an object in database', async () => {

        const id = await dbQueries.update(newObjectAttributes.id, updatedAttributes);
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read an updated object from database', async () => {

        const updatedObject = await dbQueries.read(newObjectAttributes.id);
        for (const attribute in updatedAttributes)
        {
            expect(updatedObject[attribute]).toBe(updatedAttributes[attribute]);
        }

    });

    test('should create a second new object in database', async () => {

        const newObject = new ObjectClass(newObjectAttributes2, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes2.id);

    });

    test('should read geojson collection from database', async () => {

        const _collection = await dbQueries.geojsonCollection();
        const geojsonCollection = new GeojsonCollection([], {});
        geojsonCollection.loadFromCollection(_collection.features);
        const _newObjectAttributes = Object.assign({}, newObjectAttributes) as any;
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2) as any;
        const collection = geojsonCollection.features;
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        delete _newObjectAttributes.geography;
        delete _newObjectAttributes2.geography;
        delete collection[0].properties.created_at;
        delete collection[0].properties.updated_at;
        delete collection[0].properties.mode;
        delete collection[0].properties.color;
        delete collection[1].properties.created_at;
        delete collection[1].properties.updated_at;
        delete collection[1].properties.mode;
        delete collection[1].properties.color;

        expect(collection[0].properties.id).toBe(_newObjectAttributes.id);
        expect(collection[0].properties).toEqual(new ObjectClass(_newObjectAttributes, false).attributes);
        expect(collection[1].properties.id).toBe(_newObjectAttributes2.id);
        expect(collection[1].properties).toEqual(new ObjectClass(_newObjectAttributes2, false).attributes);

    });

    test('should read geojson collection by scenario ID', async () => {
        // No scenario, expect empty path collection
        const _collection = await dbQueries.geojsonCollection({scenarioId: uuidV4()});
        const collection = _collection.features;
        expect(collection.length).toBe(0);

        // Add a trip for one of the path, then query for the scenario
        const scheduleForServiceId = {
            "allow_seconds_based_schedules": false,
            "id": uuidV4(),
            "line_id": lineId,
            "service_id": serviceId,
            "is_frozen": false,
            "periods": [{
                // Period with start and end hours and multiple trips
                "custom_start_at_str": null,
                "end_at_hour": 12,
                "inbound_path_id": null,
                "interval_seconds": 1800,
                "number_of_units": null,
                "outbound_path_id": newObjectAttributes.id,
                "period_shortname": "all_day_period_shortname",
                "start_at_hour": 7,
                "trips": [{
                    "arrival_time_seconds": 27015,
                    "block_id": "a2cadcb8-ee17-4bd7-9e77-bd400ad73064",
                    "departure_time_seconds": 25200,
                    "id": "42cadcb8-ee17-4bd7-9e77-bd400ad73064",
                    "node_arrival_times_seconds": [null, 25251, 26250, 27015],
                    "node_departure_times_seconds": [25200, 25261, 26260, null],
                    "nodes_can_board": [true, true, true, false],
                    "nodes_can_unboard": [false, true, true, true],
                    "path_id": newObjectAttributes.id,
                    "seated_capacity": 20,
                    "total_capacity": 50
                }]
            }],
            "periods_group_shortname": "all_day",
        } as any;
        await schedulesDbQueries.save(scheduleForServiceId);

        const geojsonCollection = await dbQueries.geojsonCollection({ scenarioId })
        expect(geojsonCollection.features.length).toBe(1);

    });

    test('should read geojson collection by service IDs', async () => {
        // Empty service IDs, empty feature collection
        const _collection = await dbQueries.geojsonCollectionForServices([]);
        const collection = _collection.features;
        expect(collection.length).toEqual(0);

        // Service IDs, for which there is no paths
        const _collectionEmpty = await dbQueries.geojsonCollectionForServices([uuidV4(), uuidV4()]);
        const emptyFeatures = _collectionEmpty.features;
        expect(emptyFeatures.length).toEqual(0);

        // Query for the service that has schedules
        const _geojsonCollectionForService = await dbQueries.geojsonCollectionForServices([serviceId]);
        const collectionForService = _geojsonCollectionForService.features;
        expect(collectionForService.length).toEqual(1);

        // Same but with unknown schedules
        const _geojsonCollectionForService2 = await dbQueries.geojsonCollectionForServices([serviceId, uuidV4(), uuidV4()]);
        const collectionForService2 = _geojsonCollectionForService2.features;
        expect(collectionForService2.length).toEqual(1);
    });

    test('test collections with a null geography', async () => {
        const pathWithoutGeography = _cloneDeep(newObjectAttributes) as any;
        delete pathWithoutGeography.geography;
        delete pathWithoutGeography.id;
        pathWithoutGeography.integer_id = 5;
        const newObject = new ObjectClass(pathWithoutGeography, true);
        const id = await dbQueries.create(newObject.attributes) as string;

        // 3 features in the complete collection
        const _collection = await dbQueries.collection();
        expect(_collection.length).toEqual(3);

        // 3 features with geography in default geojson collection
        const _featureCollection = await dbQueries.geojsonCollection();
        expect(_featureCollection.features.length).toEqual(3);

        // 2 features with geography in geojson collection
        const _featureCollection2 = await dbQueries.geojsonCollection({ noNullGeo: true });
        expect(_featureCollection2.features.length).toEqual(2);

        await dbQueries.delete(id)

    });

    test('should delete objects from database', async() => {

        const id = await dbQueries.delete(newObjectAttributes.id)
        expect(id).toBe(newObjectAttributes.id);

        const ids = await dbQueries.deleteMultiple([newObjectAttributes.id, newObjectAttributes2.id]);
        expect(ids).toEqual([newObjectAttributes.id, newObjectAttributes2.id]);

    });

});

describe('Paths, with transactions', () => {

    beforeEach(async () => {
        // Empty the table and add 1 object
        await dbQueries.truncate();
        const newObject = new ObjectClass(newObjectAttributes, true);
        await dbQueries.create(newObject.attributes);
    });

    test('Create, update with success', async() => {
        const newName = 'new name';
        await knex.transaction(async (trx) => {
            const newObject = new ObjectClass(newObjectAttributes2, true);
            await dbQueries.create(newObject.attributes, { transaction: trx });
            await dbQueries.update(newObjectAttributes.id, { name: newName }, { transaction: trx });
        });

        // Make sure the new object is there and the old has been updated
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(2);
        const { name, ...currentObject } = new ObjectClass(newObjectAttributes, true).attributes;
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining({
            name: newName,
            ...currentObject
        }));

        const object2 = collection.find((obj) => obj.id === newObjectAttributes2.id);
        expect(object2).toBeDefined();
        expect(object2).toEqual(expect.objectContaining(new ObjectClass(newObjectAttributes2, true).attributes));
    });

    test('Create, update with error', async() => {
        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                const newObject = new ObjectClass(newObjectAttributes2, true);
                await dbQueries.create(newObject.attributes, { transaction: trx });
                // Update with a bad field
                await dbQueries.update(newObjectAttributes.id, { simulation_id: uuidV4() } as any, { transaction: trx });
            });
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // The new object should not have been added and the one in DB should not have been updated
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining(new ObjectClass(newObjectAttributes, true).attributes));
    });

    test('Create, update, delete with error', async() => {
        const currentNewName = 'new path name';
        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                const newObject = new ObjectClass(newObjectAttributes2, true);
                await dbQueries.create(newObject.attributes, { transaction: trx });
                await dbQueries.update(newObjectAttributes.id, { name: currentNewName }, { transaction: trx });
                await dbQueries.delete(newObjectAttributes.id, { transaction: trx });
                throw 'error';
            });
        } catch(err) {
            error = err;
        }
        expect(error).toEqual('error');

        // Make sure the existing object is still there and no new one has been added
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining(new ObjectClass(newObjectAttributes, true).attributes));
    });

});

describe('Paths duplication', () => {

    beforeEach(async () => {
        // Empty the path table
        await dbQueries.truncate();
        // Emptye the lines table and add a new line
        await linesDbQueries.truncate();
        await linesDbQueries.create({
            id: lineId,
            agency_id: agencyId,
            color: '#ffffff',
        } as any);
        // Add a single path
        const newObject = new ObjectClass(newObjectAttributes, true);
        await dbQueries.create(newObject.attributes);
    });

    const add2PathsForLine = async (lineId: string) => {
        // Add 2 new paths, with uuids in a reverse order from their insertion, different names and undefined integer_ids
        const baseUuid = uuidV4();
        const firstObjectUuid = `e${baseUuid.slice(1)}`;
        const secondObjectUuid = `a${baseUuid.slice(1)}`;
        const newPath1 = new ObjectClass({
            ..._cloneDeep(newObjectAttributes),
            id: firstObjectUuid,
            line_id: lineId,
            name: 'path 1',
            integer_id: undefined
        }, true);
        const newPath2 = new ObjectClass({
            ..._cloneDeep(newObjectAttributes),
            id: secondObjectUuid,
            line_id: lineId,
            name: 'path 2',
            integer_id: undefined
        }, true);
        await dbQueries.create(newPath1.attributes);
        await dbQueries.create(newPath2.attributes);
        return [firstObjectUuid, secondObjectUuid];
    }

    test('Duplicate single path with a non-blank suffix', async () => {
        const pathIdMapping = await dbQueries.duplicate({
            pathIds: [newObjectAttributes.id],
            newPathSuffix: ' (copy)'
        });

        const duplicatedPath = await dbQueries.read(pathIdMapping[newObjectAttributes.id]);
        expect(duplicatedPath.name).toBe(`${newObjectAttributes.name} (copy)`);
    });

    test('Duplicate single path without a suffix', async () => {
        const pathIdMapping = await dbQueries.duplicate({
            pathIds: [newObjectAttributes.id],
            newPathSuffix: '   '
        });

        const duplicatedPath = await dbQueries.read(pathIdMapping[newObjectAttributes.id]);
        expect(duplicatedPath.name).toBe(newObjectAttributes.name);
    });

    test('Duplicate with duplicated path ids', async () => {
        // Count path before duplication
        const pathCountBefore = (await dbQueries.collection()).length;

        const pathIdMapping = await dbQueries.duplicate({
            pathIds: [newObjectAttributes.id, newObjectAttributes.id],
            newPathSuffix: '   '
        });

        expect(Object.keys(pathIdMapping).length).toEqual(1);
        const duplicatedPath = await dbQueries.read(pathIdMapping[newObjectAttributes.id]);
        expect(duplicatedPath.name).toBe(newObjectAttributes.name);
        // Make sure only one path was added
        const pathCountAfter = (await dbQueries.collection()).length;
        expect(pathCountAfter).toEqual(pathCountBefore + 1);
    });

    test('Duplicate for multiple paths', async () => {
        // Add 2 new paths, with uuids in a reverse order from their insertion, different names and undefined integer_ids
        const insertedUuids = await add2PathsForLine(newObjectAttributes.line_id);

        const pathIdMapping = await dbQueries.duplicate({
            pathIds: [insertedUuids[1], insertedUuids[0]],
            newPathSuffix: ' copy'
        });

        expect(pathIdMapping).toEqual({
            [insertedUuids[0]]: expect.anything(),
            [insertedUuids[1]]: expect.anything()
        })
        const duplicatedPath1 = await dbQueries.read(pathIdMapping[insertedUuids[0]]);
        const duplicatedPath2 = await dbQueries.read(pathIdMapping[insertedUuids[1]]);
        expect(duplicatedPath1.name).toBe('path 1 copy');
        expect(duplicatedPath2.name).toBe('path 2 copy');
    });

    test('Duplicate paths with line mappings', async () => {
        // Create a second line
        const newLineId = await linesDbQueries.create({
            agency_id: agencyId,
            longname: 'line copy',
            color: '#ffffee',
        } as any) as string;

        const pathIdMapping = await dbQueries.duplicate({
            lineIdMapping: { [newObjectAttributes.line_id]: newLineId },
            newPathSuffix: ' copy'
        });

        expect(pathIdMapping).toEqual({ [newObjectAttributes.id]: expect.anything() });
        const duplicatedPath = await dbQueries.read(pathIdMapping[newObjectAttributes.id]);
        expect(duplicatedPath).toEqual(expect.objectContaining({
            ...newObjectAttributes,
            name: `${newObjectAttributes.name} copy`,
            line_id: newLineId,
            integer_id: expect.anything(),
            id: pathIdMapping[newObjectAttributes.id],
            data: expect.anything() // Not equal to the attributes because they were changed by the object
        }));
        expect(duplicatedPath.integer_id).not.toBe(newObjectAttributes.integer_id);
    });

    test('Duplicate with both path ids and line mapping', async () => {
        // Add 2 new paths, with uuids in a reverse order from their insertion, different names and undefined integer_ids
        const insertedUuids = await add2PathsForLine(newObjectAttributes.line_id);

        // Create a second line
        const newLineId = await linesDbQueries.create({
            agency_id: agencyId,
            longname: 'line copy',
            color: '#ffffee',
        } as any) as string;

        // Copy only the 2 new paths to line 2
        const pathIdMapping = await dbQueries.duplicate({
            lineIdMapping: { [newObjectAttributes.line_id]: newLineId },
            pathIds: insertedUuids
        });

        expect(pathIdMapping).toEqual({
            [insertedUuids[0]]: expect.anything(),
            [insertedUuids[1]]: expect.anything()
        })
        const duplicatedPath1 = await dbQueries.read(pathIdMapping[insertedUuids[0]]);
        const duplicatedPath2 = await dbQueries.read(pathIdMapping[insertedUuids[1]]);

        // Validate both new paths, 2nd one should have higher integer_id
        expect(duplicatedPath1).toEqual(expect.objectContaining({
            ...newObjectAttributes,
            name: 'path 1',
            line_id: newLineId,
            integer_id: expect.anything(),
            id: pathIdMapping[insertedUuids[0]],
            data: expect.anything() // Not equal to the attributes because they were changed by the object
        }));
        expect(duplicatedPath2).toEqual(expect.objectContaining({
            ...newObjectAttributes,
            name: 'path 2',
            line_id: newLineId,
            integer_id: expect.anything(),
            id: pathIdMapping[insertedUuids[1]],
            data: expect.anything() // Not equal to the attributes because they were changed by the object
        }));
        expect(duplicatedPath1.integer_id).toBeLessThan(duplicatedPath2.integer_id);
    });

    test('Duplicate when there are no paths for the line', async() => {
        // Create a second line, without paths
        const newLineId = await linesDbQueries.create({
            agency_id: agencyId,
            longname: 'new line',
            color: '#ffffee',
        } as any) as string;

        // Create a third line, copy of the second
        const newLineId2 = await linesDbQueries.create({
            agency_id: agencyId,
            longname: 'new line copy',
            color: '#ffffee',
        } as any) as string;

        // Copy only the 2 new paths to line 2
        const pathIdMapping = await dbQueries.duplicate({
            lineIdMapping: { [newLineId]: newLineId2 }
        });

        expect(pathIdMapping).toEqual({});
    });

    test('Duplicate for unexisting path IDs', async() => {
        // Copy only the 2 new paths to line 2
        const pathIdMapping = await dbQueries.duplicate({
            pathIds: [uuidV4()]
        });

        expect(pathIdMapping).toEqual({});
    });

    test('Duplicate for unexisting lines', async() => {
        // Copy only the 2 new paths to line 2
        const pathIdMapping = await dbQueries.duplicate({
            lineIdMapping: { [uuidV4()]: uuidV4() }
        });

        expect(pathIdMapping).toEqual({});
    });

    test('Test transaction: duplication fine, but transaction fails later', async() => {
        let error: any = undefined;
        try {
            // Wrap in a transaction
            await knex.transaction(async (trx) => {
                // Update, then delete the schedule, then throw an error
                await dbQueries.duplicate({ pathIds: [newObjectAttributes.id], transaction: trx });
                // Throw an error to make transaction fail
                throw 'manualTransactionFailure';
            });
        } catch(err) {
            error = err;
        }
        expect(error).toEqual('manualTransactionFailure');

        // Make sure there is still only 1 schedule
        const pathsInDb = await dbQueries.collection();
        expect(pathsInDb.length).toEqual(1);
    });

    test('No mapping provided, should throw error', async () => {
        // Duplicate the path without mapping, should throw an error
        await expect(dbQueries.duplicate({ })).rejects.toThrow(TrError);
    });

    test('Mapping to non uuid line ids, should throw error', async () => {
        // Duplicate the path with invalid line id
        await expect(dbQueries.duplicate({ lineIdMapping: { notAUuid: 'other' } })).rejects.toThrow(TrError);
    });

    test('Mapping to non uuid path ids, should throw error', async () => {
        // Duplicate the path with invalid path ids
        await expect(dbQueries.duplicate({ pathIds: ['not a uuid'] })).rejects.toThrow(TrError);
    });

});
