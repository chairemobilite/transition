/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _omit from 'lodash.omit';
import _cloneDeep from 'lodash.clonedeep';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';

import Service from '../Service';
import { duplicateService } from '../ServiceDuplicator';
import ServiceCollection from '../ServiceCollection';

const serviceSaveFct = Service.prototype.save = jest.fn();
const eventManager = EventManagerMock.eventManagerMock;

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

let serviceCollection: ServiceCollection;
let collectionManager: CollectionManager;

beforeEach(() => {
    serviceCollection = new ServiceCollection([], {});
    collectionManager = new CollectionManager(eventManager, {
        services: serviceCollection
    });
    serviceSaveFct.mockClear();
    EventManagerMock.mockClear();
})

test('duplicate service', async () => {

    // Add a service that is not new
    const baseService = new Service(serviceAttributes1, false, collectionManager);
    serviceCollection.add(baseService);

    // Copy the service a first time
    const copy1 = await duplicateService(baseService, { socket: eventManager, serviceCollection });

    expect(copy1.getAttributes().id).not.toEqual(baseService.getAttributes().id);
    expect(copy1.getAttributes().name).not.toEqual(baseService.getAttributes().name);
    const expected = _omit(serviceAttributes1, ['id', 'name']);
    const actual = _omit(copy1.getAttributes(), ['id', 'name']);

    expect(actual).toEqual(expected);
    expect(serviceSaveFct).toHaveBeenCalledTimes(1);
    expect(serviceCollection.size()).toEqual(2);
    
    // Make a second copy to make sure it id added with a different acronym
    const copy2 = await duplicateService(baseService, { socket: eventManager, serviceCollection });

    expect(copy2.getAttributes().id).not.toEqual(baseService.getAttributes().id);
    expect(copy2.getAttributes().id).not.toEqual(copy1.getAttributes().id);
    expect(copy2.getAttributes().name).not.toEqual(baseService.getAttributes().name);
    expect(copy2.getAttributes().name).not.toEqual(copy1.getAttributes().name);
    expect(serviceSaveFct).toHaveBeenCalledTimes(2);
    expect(serviceCollection.size()).toEqual(3);

});

test('duplicate service with suffix', async () => {

    // Add a service that is not new
    const baseService = new Service(serviceAttributes1, false, collectionManager);
    serviceCollection.add(baseService);

    // Copy the service a first time
    const suffix = 'suffix';
    const copy1 = await duplicateService(baseService, { socket: eventManager, serviceCollection, newServiceSuffix: suffix });

    expect(copy1.getAttributes().id).not.toEqual(baseService.getAttributes().id);
    expect(copy1.getAttributes().name).not.toEqual(baseService.getAttributes().name);
    expect(copy1.getAttributes().name).toContain(suffix);
    
    expect(serviceSaveFct).toHaveBeenCalledTimes(1);
    expect(serviceCollection.size()).toEqual(2);
});

test('duplicate service no collection or suffix', async () => {

    // Add a service that is not new
    const baseService = new Service(serviceAttributes1, false, collectionManager);
    serviceCollection.add(baseService);

    // Copy the service a first time
    const copy1 = await duplicateService(baseService, { socket: eventManager });

    expect(copy1.getAttributes().id).not.toEqual(baseService.getAttributes().id);
    expect(copy1.getAttributes().name).toEqual(baseService.getAttributes().name);
    
    expect(serviceSaveFct).toHaveBeenCalledTimes(1);
    expect(serviceCollection.size()).toEqual(1);
});
