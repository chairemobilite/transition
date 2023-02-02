/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep                       from 'lodash.clonedeep';
import { lineString as turfLineString } from '@turf/helpers';

import dbQueries from '../transitPaths.db.queries';
import linesDbQueries from '../transitLines.db.queries';
import scenariosDbQueries from '../transitScenarios.db.queries';
import schedulesDbQueries from '../transitSchedules.db.queries';
import servicesDbQueries from '../transitServices.db.queries';
import agencyDbQueries from '../transitAgencies.db.queries'
import GeojsonCollection from 'transition-common/lib/services/path/PathCollection';
import ObjectClass from 'transition-common/lib/services/path/Path';

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
    schedulesDbQueries.destroy();
    schedulesDbQueries.destroy();
    schedulesDbQueries.destroy();
    servicesDbQueries.destroy();
    scenariosDbQueries.destroy();
    dbQueries.destroy();
    linesDbQueries.destroy();
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
        const _newObjectAttributes = newObject.getAttributes();
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
        expect(collection[0].properties).toEqual(new ObjectClass(_newObjectAttributes, false).getAttributes());
        expect(collection[1].properties.id).toBe(_newObjectAttributes2.id);
        expect(collection[1].properties).toEqual(new ObjectClass(_newObjectAttributes2, false).getAttributes());
        
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
        await schedulesDbQueries.create(scheduleForServiceId);

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
        const id = await dbQueries.create(newObject.attributes);
        
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
