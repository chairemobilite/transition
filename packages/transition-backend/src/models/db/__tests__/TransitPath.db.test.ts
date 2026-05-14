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
import { cleanScenarioData, insertDataForScenarios } from './transitDataByScenario.db.data';

const objectName = 'path';
const agencyId = uuidV4();
const lineId = uuidV4();
const serviceId = uuidV4();

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

    test('should read geojson collection by service IDs', async () => {
        // Empty service IDs, empty feature collection
        const _collection = await dbQueries.geojsonCollectionForServices([]);
        const collection = _collection.features;
        expect(collection.length).toEqual(0);

        // Service IDs, for which there is no paths
        const _collectionEmpty = await dbQueries.geojsonCollectionForServices([uuidV4(), uuidV4()]);
        const emptyFeatures = _collectionEmpty.features;
        expect(emptyFeatures.length).toEqual(0);

        // Add a schedule for one of the path, then query for the scenario
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

describe('Lines, filtered by scenarios', () => {

    let scenarioDbData: any;
    beforeAll(async () => {
        scenarioDbData = await insertDataForScenarios();
    });

    afterAll(async () => {
        await cleanScenarioData();
    });

    test('Get paths for a specific scenario, all paths expected', async() => {
        const expectedIds = scenarioDbData.pathIds;
        const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWithBothServices);

        expect(paths.features.length).toEqual(expectedIds.length);
        for (const path of paths.features) {
            expect(expectedIds).toContain((path as any).properties.id);
        }
    });

    test('Get paths for a specific scenario, filtered paths expected', async () => {
        // No path for service 2
        const expectedIds = [];
        const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWithService2);

        expect(paths.features.length).toEqual(expectedIds.length);
    });

    test('Get paths for a specific scenario, with only agencies', async() => {
        const expectedIds = [scenarioDbData.pathIds[0]];
        const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWithBothServicesOnlyAgency1);

        expect(paths.features.length).toEqual(expectedIds.length);
        for (const path of paths.features) {
            expect(expectedIds).toContain((path as any).properties.id);
        }
    });

    test('Get paths for a specific scenario, with exclude agencies', async() => {
        const expectedIds = [scenarioDbData.pathIds[1]];
        const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWithBothServicesWithoutAgency1);

        expect(paths.features.length).toEqual(expectedIds.length);
        for (const path of paths.features) {
            expect(expectedIds).toContain((path as any).properties.id);
        }
    });

    test('Get paths for a specific scenario, with only lines', async() => {
        const expectedIds = [scenarioDbData.pathIds[0]];
        const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWithBothServicesOnlyLine1);

        expect(paths.features.length).toEqual(expectedIds.length);
        for (const path of paths.features) {
            expect(expectedIds).toContain((path as any).properties.id);
        }
    });

    test('Get paths for a specific scenario, with excluded lines', async() => {
        const expectedIds = [scenarioDbData.pathIds[1]];
        const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWithBothServicesWithoutLine1);

        expect(paths.features.length).toEqual(expectedIds.length);
        for (const path of paths.features) {
            expect(expectedIds).toContain((path as any).properties.id);
        }
    });

    test('Get paths for a specific scenario, 2 lines exluded, should be empty', async() => {
        const expectedIds = [];
        const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWith2LinesExcluded);

        expect(paths.features.length).toEqual(expectedIds.length);
    });

    test('Get paths for a specific scenario, with include multiple lines, should have all lines', async() => {
            const expectedIds = [scenarioDbData.pathIds[0], scenarioDbData.pathIds[1]];
            const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWith2LinesIncluded);
    
            expect(paths.features.length).toEqual(expectedIds.length);
        for (const path of paths.features) {
            expect(expectedIds).toContain((path as any).properties.id);
        }
        });

    test('Get paths for a specific scenario, empty scenario', async() => {
        const expectedIds = [];
        const paths = await dbQueries.geojsonCollectionForScenario(scenarioDbData.scenarios.scenarioIdWithEmptyServices);

        expect(paths.features.length).toEqual(expectedIds.length);
    });

});