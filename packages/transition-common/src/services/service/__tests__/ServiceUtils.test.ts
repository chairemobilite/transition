import { v4 as uuidV4 } from 'uuid';

import Service from '../Service';
import { getUniqueServiceName } from '../ServiceUtils';
import ServiceCollection from '../ServiceCollection';

const serviceAttributes1 = {
    id: uuidV4(),
    name: 'S1',
    is_frozen: false,
};

const serviceAttributes2 = {
    id: uuidV4(),
    name: 'S1-1',
    is_frozen: false,
};

const serviceAttributesWithNoName = {
    id: uuidV4(),
    is_frozen: false,
};

let serviceCollection = new ServiceCollection([new Service(serviceAttributes1, false), new Service(serviceAttributes2, false), new Service(serviceAttributesWithNoName, false)], {});

describe('Get unique name', () => {
    test('not exists', () => {
        const uniqueName = 'UniqA'
        const newName = getUniqueServiceName(serviceCollection, uniqueName);
        expect(newName).toEqual(uniqueName);
    });
    
    test('exists', () => {
        const newName = getUniqueServiceName(serviceCollection, serviceAttributes1.name);
        expect(newName).not.toEqual(serviceAttributes1.name);
        expect(newName).not.toEqual(serviceAttributes2.name);
    });

    test('undefined services', () => {
        const uniqueName = 'UniqA'
        const newName = getUniqueServiceName(undefined, uniqueName);
        expect(newName).toEqual(uniqueName);
    })
});
