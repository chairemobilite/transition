/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import Service from '../Service';
import ServiceCollection from '../ServiceCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

const serviceAttributes1 = {
    id: uuidV4(),
    name: 'Service1',
    data: {
        variables: {}
    },
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_date: '2020-01-01',
    end_date: '2020-12-31',
    is_frozen: false
};

const serviceAttributes2= {
    id: uuidV4(),
    name: 'Service2',
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: true,
    sunday: true,
    start_date: '2000-01-01',
    end_date: '2000-01-01',
    description: 'descS2',
    internal_id: 's222ccc',
    color: '#ff0000',
    data: {
        foo: 'bar',
        variables: {}
    },
    is_frozen: true
};

const serviceAttributes3= {
    id: uuidV4(),
    name: 'Service3',
    monday: true,
    tuesday: false,
    wednesday: true,
    thursday: false,
    friday: true,
    saturday: false,
    sunday: true,
    start_date: '2000-01-01',
    end_date: '2001-01-02',
    description: 'descS3',
    internal_id: 's333ccc',
    only_dates: ['2000-01-01', '2001-01-01'],
    except_dates: ['2001-01-02'],
    color: '#000000',
    data: {
        foo: 'bar3',
        variables: {}
    },
    is_frozen: false
};

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct service collection with or without features', function() {

    const service1 = new Service(serviceAttributes1, true);
    const service2 = new Service(serviceAttributes2, false);
    const service3 = new Service(serviceAttributes3, false);

    const serviceCollectionEmpty = new ServiceCollection([], {}, eventManager);
    const serviceCollection2 = new ServiceCollection([service1, service2], {}, eventManager);
    const serviceCollection3 = new ServiceCollection([service1, service2, service3], {}, eventManager);

    expect(serviceCollectionEmpty.size()).toBe(0);
    expect(serviceCollection2.size()).toBe(2);
    expect(serviceCollection3.size()).toBe(3);

    expect(serviceCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(serviceCollection2.getFeatures()[0]).toMatchObject(service1);
    expect(serviceCollection3.getFeatures()[2]).toMatchObject(service3);
    expect(serviceCollectionEmpty.getById(serviceAttributes1.id)).toBeUndefined();
    expect(serviceCollection2.getById(serviceAttributes1.id)).toMatchObject(service1);
    expect(serviceCollection2.getById(serviceAttributes3.id)).toBeUndefined();
    expect(serviceCollection3.getById(serviceAttributes3.id)).toMatchObject(service3);

    serviceCollectionEmpty.add(service1);
    expect(serviceCollectionEmpty.size()).toBe(1);
    expect(serviceCollectionEmpty.getById(serviceAttributes1.id)).toMatchObject(service1);
    serviceCollectionEmpty.removeById(serviceAttributes1.id);
    expect(serviceCollectionEmpty.size()).toBe(0);
    expect(serviceCollectionEmpty.getFeatures()[0]).toBeUndefined();

    expect(serviceCollection3.forJson()[2]).toEqual(serviceAttributes3);
    expect(serviceCollection3.forCsv()[2]).toEqual({
        uuid: serviceAttributes3.id,
        name: serviceAttributes3.name,
        internal_id: serviceAttributes3.internal_id,
        start_date: serviceAttributes3.start_date,
        end_date: serviceAttributes3.end_date,
        monday: serviceAttributes3.monday,
        tuesday: serviceAttributes3.tuesday,
        wednesday: serviceAttributes3.wednesday,
        thursday: serviceAttributes3.thursday,
        friday: serviceAttributes3.friday,
        saturday: serviceAttributes3.saturday,
        sunday: serviceAttributes3.sunday,
        color: serviceAttributes3.color,
        only_dates: '2000-01-01|2001-01-01',
        except_dates: '2001-01-02',
        description: serviceAttributes3.description
    });

});

test('Load from server', async () => {
    EventManagerMock.emitResponseReturnOnce({collection: [serviceAttributes1, serviceAttributes2]});

    // Test loading a simple collection
    const collection = new ServiceCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitServices.collection', null, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const agency1 = collection.getFeatures()[0];
    const agency2 = collection.getFeatures()[1];
    expect(agency1).toEqual(new Service(serviceAttributes1, false));
    expect(agency2).toEqual(new Service(serviceAttributes2, false));
    expect(agency1.collectionManager).toEqual(collectionManager);
    expect(agency2.collectionManager).toEqual(collectionManager);

});

describe('deleteById', () => {
    test('deleteById should delete only matching non-frozen services', async () => {
        const service1 = new Service(serviceAttributes1, false);
        const service2 = new Service(serviceAttributes2, false);
        const service3 = new Service(serviceAttributes3, false);
        const service4 = new Service({ ...serviceAttributes3, id: uuidV4() }, false);
        const collection = new ServiceCollection([service1, service2, service3, service4], {}, eventManager);
        const socket = eventManager;

        const deleteSpy1 = jest.spyOn(service1, 'delete').mockResolvedValue({ status: 'ok', result: { id: service1.getId() } });
        const deleteSpy2 = jest.spyOn(service2, 'delete');
        const deleteSpy3 = jest.spyOn(service3, 'delete').mockResolvedValue({ status: 'ok', result: { id: service3.getId() } });
        const deleteSpy4 = jest.spyOn(service4, 'delete').mockResolvedValue({ status: 'ok', result: { id: service4.getId() } });

        await collection.deleteByIds([service1.getId(), service2.getId(), service3.getId()], socket);

        expect(deleteSpy1).toHaveBeenCalledTimes(1);
        expect(deleteSpy1).toHaveBeenCalledWith(socket);
        // service2 is frozen, so it should not be deleted
        expect(deleteSpy2).not.toHaveBeenCalled();
        expect(deleteSpy3).toHaveBeenCalledTimes(1);
        expect(deleteSpy3).toHaveBeenCalledWith(socket);
        // service4 is not scheduled to be deleted
        expect(deleteSpy4).not.toHaveBeenCalled();
    });

    test('deleteById should ignore unknown ids', async () => {
        const service1 = new Service(serviceAttributes1, false);
        const collection = new ServiceCollection([service1], {}, eventManager);
        const socket = eventManager;

        const deleteSpy = jest.spyOn(service1, 'delete').mockResolvedValue({ status: 'ok', result: { id: service1.getId() } });

        await collection.deleteByIds([uuidV4()], socket);

        expect(deleteSpy).not.toHaveBeenCalled();
    });

    test('deleteById should complete even if some deletions fail', async () => {
        const service1 = new Service(serviceAttributes1, false);
        const service2 = new Service(serviceAttributes2, false);
        const service3 = new Service(serviceAttributes3, false);
        const collection = new ServiceCollection([service1, service2, service3], {}, eventManager);
        const socket = eventManager;

        const deleteSpy1 = jest.spyOn(service1, 'delete').mockResolvedValue({ status: 'ok', result: { id: service1.getId() } });
        const deleteSpy3 = jest.spyOn(service3, 'delete').mockResolvedValue({ status: 'error', error: 'Deletion failed' });
        
        await collection.deleteByIds([service1.getId(), service3.getId()], socket);
        // No exception expected, even if service3 deletion fails

        expect(deleteSpy1).toHaveBeenCalledTimes(1);
        expect(deleteSpy1).toHaveBeenCalledWith(socket);
        // Delete was called, but returned error
        expect(deleteSpy3).toHaveBeenCalledTimes(1);
        expect(deleteSpy3).toHaveBeenCalledWith(socket);
    });
});

test('static attributes', () => {
    const collection = new ServiceCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('Services');
    expect(collection.socketPrefix).toEqual('transitServices');
    expect(collection.displayName).toEqual('ServiceCollection');
});
