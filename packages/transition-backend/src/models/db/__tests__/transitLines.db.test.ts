/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import dbQueries         from '../transitLines.db.queries';
import agenciesDbQueries from '../transitAgencies.db.queries';
import servicesDbQueries from '../transitServices.db.queries';
import schedulesDbQueries from '../transitSchedules.db.queries';
import pathsDbQueries from '../transitPaths.db.queries';
import Collection        from 'transition-common/lib/services/line/LineCollection';
import ObjectClass, { Line, LineAttributes }       from 'transition-common/lib/services/line/Line';

const objectName = 'line';
const agencyId   = '273a583c-df49-440f-8f44-f39fb0033c56';
const serviceId = uuidV4();
const serviceId2 = uuidV4();
const lineId = uuidV4();

const scheduleForServiceId = {
    "allow_seconds_based_schedules": false,
    "id": uuidV4(),
    "service_id": serviceId,
    "is_frozen": false,
    "periods": [],
    "periods_group_shortname": "all_day",
    line_id: lineId,
    data: {}
};

const scheduleForServiceId2 = {
    "allow_seconds_based_schedules": false,
    "id": uuidV4(),
    "service_id": serviceId2,
    "is_frozen": false,
    "periods": [],
    "periods_group_shortname": "all_day",
    line_id: lineId,
    data: {}
};

const pathAttributes = {  
    id          : uuidV4(),
    internal_id : 'InternalId test 1',
    is_frozen   : false,
    is_enabled  : true,
    line_id     : lineId,
    name        : 'South',
    direction   : 'outbound' as const,
    integer_id  : 1,
    geography   : { type: 'LineString' as const, coordinates: [[-73.6, 45.5], [-73.5, 45.6], [-73.5, 45.4]] },
    nodes       : [uuidV4(), uuidV4()],
    stops       : [],
    segments    : [0, 78],
    data        : {
        defaultAcceleration: 1.0,
        defaultDeceleration: 1.0,
        defaultRunningSpeedKmH: 20,
        maxRunningSpeedKmH: 100,
        routingEngine: 'engine' as const,
        routingMode: 'bus',
        foo: 'bar',
        bar: 'foo',
        waypoints: [],
        waypointTypes: [],
        nodeTypes: [
            'engine',
            'engine'
        ]
    }
};

const newObjectAttributesWithSchedule: LineAttributes = {
  id                       : lineId,
  internal_id              : 'InternalId test 1',
  is_frozen                : false,
  is_enabled               : true,
  agency_id                : agencyId,
  shortname                : '1',
  longname                 : 'Name',
  mode                     : 'bus' as const,
  category                 : 'C+' as const,
  allow_same_line_transfers: false,
  color                    : '#ffffff',
  description              : undefined,
  is_autonomous            : false,
  scheduleByServiceId      : { [serviceId]: scheduleForServiceId, [serviceId2]: scheduleForServiceId2 },
  path_ids: [],
  data                     : {
    foo: 'bar',
    bar: 'foo'
  }
};

const newObjectAttributes2: LineAttributes = {
  id                       : uuidV4(),
  internal_id              : 'InternalId test 20',
  is_frozen                : false,
  is_enabled               : true,
  agency_id                : agencyId,
  shortname                : '20',
  longname                 : 'Name 20',
  mode                     : 'tram' as const,
  category                 : 'B' as const,
  allow_same_line_transfers: true,
  color                    : '#000000',
  description              : 'Description 20',
  is_autonomous            : true,
  scheduleByServiceId: {},
  path_ids: [],
  data        : {
    foo2: 'bar2',
    bar2: 'foo2'
  }
};

const updatedAttributes = {
  shortname    : '12',
  description: 'Changed description',
  scheduleByServiceId      : { },
  data        : {
    foo2: 'bar2',
    bar2: 'foo2'
  }
};

beforeAll(async function() {
    jest.setTimeout(10000);
    await pathsDbQueries.truncate();
    await dbQueries.truncate();
    await servicesDbQueries.create({
        id: serviceId
    } as any);
    await servicesDbQueries.create({
        id: serviceId2
    } as any);
    await agenciesDbQueries.create({
        id: agencyId
    } as any);
});

afterAll(async function() {
    await pathsDbQueries.truncate();
    await dbQueries.truncate();
    await agenciesDbQueries.truncate();
    await servicesDbQueries.truncate();
    await dbQueries.destroy();
    await servicesDbQueries.destroy();
    await agenciesDbQueries.destroy();
});

describe(`${objectName}`, () => {

    test('exists should return false if object is not in database', async () => {

        const exists = await dbQueries.exists(uuidV4())
        expect(exists).toBe(false);

    });

    test('should create a new object in database', async() => {

        const attributes = _cloneDeep(newObjectAttributesWithSchedule);
        const newObject = new ObjectClass(attributes, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributesWithSchedule.id);

    });

    test('should not insert with null agency_id', async() => {
        // Clone object and reset agency_id and id
        const attributes = _cloneDeep(newObjectAttributesWithSchedule) as any;
        delete attributes.id;
        delete attributes.agency_id;
        const newObject = new ObjectClass(attributes, true);
        let exception: any = undefined;
        try {
            await dbQueries.create(newObject.attributes)
        } catch(error) {
            exception = error;
        }
        expect(exception).toBeDefined();

    });

    test('should read a new object in database', async() => {
        const _attributesWithoutSchedules = _cloneDeep(newObjectAttributesWithSchedule);
        _attributesWithoutSchedules.scheduleByServiceId = {};
        const attributes = await dbQueries.read(newObjectAttributesWithSchedule.id) as any;
        delete attributes.updated_at;
        delete attributes.created_at;
        expect(attributes).toMatchObject(_attributesWithoutSchedules);

    });

    test('Update a line in database', async() => {
        
        const id = await dbQueries.update(newObjectAttributesWithSchedule.id, updatedAttributes);
        expect(id).toBe(newObjectAttributesWithSchedule.id);

    });

    test('Read an updated line from database, without schedules', async() => {

        const updatedObject = await dbQueries.read(newObjectAttributesWithSchedule.id) as any;
        expect(updatedObject).toMatchObject(updatedAttributes);
        for (const attribute in updatedAttributes)
        {
            expect(updatedObject[attribute]).toEqual(updatedAttributes[attribute]);
        }

    });

    test('Go back to original line and save schedules and path', async () => {

        const _updatedAttributes = Object.assign({}, newObjectAttributesWithSchedule);
        const updatedObject = new ObjectClass(_updatedAttributes, false);
        const id = await dbQueries.update(newObjectAttributesWithSchedule.id, updatedObject.getAttributes());
        await schedulesDbQueries.create(scheduleForServiceId);
        await schedulesDbQueries.create(scheduleForServiceId2);
        await pathsDbQueries.create(pathAttributes);
        expect(id).toBe(newObjectAttributesWithSchedule.id);

    });

    test('Read a line object with new schedules from database', async () => {

        const _updatedAttributes = Object.assign({}, newObjectAttributesWithSchedule);
        _updatedAttributes.path_ids = [pathAttributes.id];
        const updatedObject = await dbQueries.read(newObjectAttributesWithSchedule.id);
        expect(updatedObject).toMatchObject(_updatedAttributes);

    });

    test('Update a line with no schedules fetched', async() => {
        const attributesWihoutSched = _cloneDeep(newObjectAttributesWithSchedule) as any;
        delete attributesWihoutSched.scheduleByServiceId;
        const lineObject = new ObjectClass(attributesWihoutSched, false);
        // Should not save the schedules, because there are none in the object
        await dbQueries.update(newObjectAttributesWithSchedule.id, lineObject.attributes);
        const readLine = await dbQueries.read(newObjectAttributesWithSchedule.id);
        expect(readLine).toMatchObject(Object.assign({}, newObjectAttributesWithSchedule, { path_ids: [pathAttributes.id] }));
    });

    test('should create a second new object in database', async() => {
        
        const newObject = new ObjectClass(newObjectAttributes2, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toEqual(newObjectAttributes2.id);

    });

    test('should read collection from database', async() => {
        
        const _collection = await dbQueries.collection();
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributesWithSchedule) as any;
        _newObjectAttributes.path_ids = [pathAttributes.id];
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2) as any;
        expect(collection.length).toBe(2);
        delete collection[0].attributes.created_at;
        delete collection[1].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[1].attributes.updated_at;
        delete _newObjectAttributes.scheduleByServiceId;
        // Sort service_ids array
        _newObjectAttributes.service_ids = [serviceId, serviceId2].sort((sidA, sidB) => sidA.localeCompare(sidB));
        collection[0].attributes.service_ids?.sort((sidA, sidB) => sidA.localeCompare(sidB));
        collection[1].attributes.service_ids?.sort((sidA, sidB) => sidA.localeCompare(sidB));
        expect(collection[0].getId()).toBe(_newObjectAttributes.id);
        expect(collection[0].getAttributes()).toMatchObject(new ObjectClass(_newObjectAttributes, false).getAttributes());
        expect(collection[1].getId()).toBe(_newObjectAttributes2.id);
        expect(collection[1].getAttributes()).toMatchObject(new ObjectClass(_newObjectAttributes2, false).getAttributes());
        
    });

    test('should read collection from database with specific line ids', async() => {
        
        const _collection = await dbQueries.collection([newObjectAttributesWithSchedule.id, uuidV4()]);
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributesWithSchedule) as any;
        _newObjectAttributes.path_ids = [pathAttributes.id];
        expect(collection.length).toBe(1);
        delete collection[0].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete _newObjectAttributes.scheduleByServiceId;
        // Sort service_ids array
        _newObjectAttributes.service_ids = [serviceId, serviceId2].sort((sidA, sidB) => sidA.localeCompare(sidB));
        collection[0].attributes.service_ids?.sort((sidA, sidB) => sidA.localeCompare(sidB));
        expect(collection[0].getId()).toBe(_newObjectAttributes.id);
        expect(collection[0].getAttributes()).toMatchObject(new ObjectClass(_newObjectAttributes, false).getAttributes());
                
    });

    test('should read collection with schedules from database', async () => {
        
        const _collection = await dbQueries.collection();
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        // Make sure the original object has no schedules
        expect((objectCollection.getById(newObjectAttributesWithSchedule.id) as Line).getAttributes().scheduleByServiceId).toEqual({});
        await dbQueries.collectionWithSchedules(objectCollection.features);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributesWithSchedule);
        _newObjectAttributes.path_ids = [pathAttributes.id];
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2);
        delete collection[0].attributes.created_at;
        delete collection[1].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[1].attributes.updated_at;
        // Sort service_ids array
        _newObjectAttributes.service_ids = [serviceId, serviceId2].sort((sidA, sidB) => sidA.localeCompare(sidB));
        collection[0].attributes.service_ids?.sort((sidA, sidB) => sidA.localeCompare(sidB));
        collection[1].attributes.service_ids?.sort((sidA, sidB) => sidA.localeCompare(sidB));
        expect(collection[0].getId()).toEqual(_newObjectAttributes.id);
        expect(collection[0].getAttributes()).toMatchObject(new ObjectClass(_newObjectAttributes, false).getAttributes());
        expect(collection[1].getId()).toEqual(_newObjectAttributes2.id);
        expect(collection[1].getAttributes()).toMatchObject(new ObjectClass(_newObjectAttributes2, false).getAttributes());
    });

    test('should delete objects from database', async() => {
        
        const id = await dbQueries.delete(newObjectAttributesWithSchedule.id)
        expect(id).toBe(newObjectAttributesWithSchedule.id);

        const ids = await dbQueries.deleteMultiple([newObjectAttributesWithSchedule.id, newObjectAttributes2.id]);
        expect(ids).toEqual([newObjectAttributesWithSchedule.id, newObjectAttributes2.id]);

    });

});
