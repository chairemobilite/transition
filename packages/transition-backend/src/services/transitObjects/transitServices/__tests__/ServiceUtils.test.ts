/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import { getUniqueServiceName, getServicesById, saveServices } from '../ServiceUtils';
import transitServicesDbQueries from '../../../../models/db/transitServices.db.queries';
import Service, { ServiceAttributes } from 'transition-common/lib/services/service/Service';
import TrError from 'chaire-lib-common/lib/utils/TrError';

// Mock the knex transaction object.
const transactionObjectMock = new Object(3);

jest.mock('chaire-lib-backend/lib/config/shared/db.config', () => ({
    transaction: jest.fn().mockImplementation(async (callback) => await callback(transactionObjectMock))
}));

jest.mock('../../../../models/db/transitServices.db.queries', () => ({
    getServiceNamesStartingWith: jest.fn(),
    collection: jest.fn(),
    createMultiple: jest.fn(),
    updateMultiple: jest.fn()
}));
const mockGetServiceNamesStartingWith = transitServicesDbQueries.getServiceNamesStartingWith as jest.MockedFunction<typeof transitServicesDbQueries.getServiceNamesStartingWith>;   
const mockCollection = transitServicesDbQueries.collection as jest.MockedFunction<typeof transitServicesDbQueries.collection>;   
const mockCreateMultiple = transitServicesDbQueries.createMultiple as jest.MockedFunction<typeof transitServicesDbQueries.createMultiple>;   
const mockUpdateMultiple = transitServicesDbQueries.updateMultiple as jest.MockedFunction<typeof transitServicesDbQueries.updateMultiple>;   

const serviceAttributes1: ServiceAttributes = {  
    id           : uuidV4(),
    name         : 'Service test',
    internal_id  : 'internalIdTest1',
    is_frozen    : false,
    is_enabled   : true,
    monday       : true,
    tuesday      : true,
    wednesday    : true,
    thursday     : true,
    friday       : true,
    saturday     : false,
    sunday       : false,
    start_date   : '2019-01-01',
    end_date     : '2019-03-09',
    only_dates   : [],
    except_dates : ['2019-02-02'],
    color        : '#ffffff',
    description  : undefined,
    simulation_id: undefined,
    scheduled_lines: [],
    data         : {
      foo: 'bar',
      bar: 'foo',
      variables: {}
    }
  };
  
  const serviceAttributes2: ServiceAttributes = {
    id           : uuidV4(),
    name         : 'Service test 2',
    internal_id  : 'internalIdTest2',
    is_frozen    : false,
    is_enabled   : true,
    monday       : false,
    tuesday      : false,
    wednesday    : false,
    thursday     : false,
    friday       : false,
    saturday     : true,
    sunday       : true,
    start_date   : '2018-02-24',
    end_date     : '2018-08-16',
    only_dates   : ['2018-09-14', '2018-09-15'],
    except_dates : [],
    color        : '#000000',
    description  : 'description test',
    scheduled_lines: [],
    data         : {
      foo2: 'bar2',
      bar2: 'foo2',
      variables: {}
    }
  };

describe('getServicesById', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return an empty array when no service IDs are provided', async () => {
        const serviceIds: string[] = [];

        // Make the request to get the services by ID
        const services = await getServicesById(serviceIds);
        expect(services).toEqual([]);
        expect(mockCollection).not.toHaveBeenCalled();
    });

    it('should return an array of service objects when valid service IDs are provided', async () => {
        const serviceIds: string[] = [serviceAttributes1.id, serviceAttributes2.id];
        
        // Mock the database query to return the expected services
        mockCollection.mockResolvedValueOnce([serviceAttributes1, serviceAttributes2]);

        // Make the request to get the services by ID
        const services = await getServicesById(serviceIds);

        // Validate the results
        expect(services).toEqual([new Service(serviceAttributes1, false), new Service(serviceAttributes2, false)]);
        expect(mockCollection).toHaveBeenCalledWith({ serviceIds });
    });

    it('should return an array of service objects when valid service IDs are provided', async () => {
        const currentTransaction = new Object(2) as any;
        const serviceIds: string[] = [serviceAttributes1.id, serviceAttributes2.id];
        
        // Mock the database query to return the expected services
        mockCollection.mockResolvedValueOnce([serviceAttributes1, serviceAttributes2]);

        // Make the request to get the services by ID
        const services = await getServicesById(serviceIds, { transaction: currentTransaction });

        // Validate the results
        expect(services).toEqual([new Service(serviceAttributes1, false), new Service(serviceAttributes2, false)]);
        expect(mockCollection).toHaveBeenCalledWith({ serviceIds, transaction: currentTransaction });
    });

    it('should handle errors when querying the database', async () => {
        const serviceIds: string[] = [serviceAttributes1.id, serviceAttributes2.id];
        
        // Mock an error to the database query
        mockCollection.mockRejectedValueOnce(new TrError('Database error', 'ERRCODE'));
        
        await expect(getServicesById(serviceIds)).rejects.toThrow('Database error');
        expect(mockCollection).toHaveBeenCalledWith({ serviceIds });
    });
});

describe('saveServices', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    it('should save services to the database, only existing services', async () => {
        const services: Service[] = [new Service(serviceAttributes1, false), new Service(serviceAttributes2, false)];
        
        // Make the request to save the services
        await saveServices(services);        
        
        // Validate that the createMultiple function was called with the correct parameters
        expect(mockCreateMultiple).not.toHaveBeenCalled();
        expect(mockUpdateMultiple).toHaveBeenCalledWith(services.map(service => service.attributes), { returning: 'id', transaction: transactionObjectMock});
    });

    it('should save services to the database, only new services', async () => {
        const services: Service[] = [new Service(serviceAttributes1, true), new Service(serviceAttributes2, true)];
        
        // Make the request to save the services
        await saveServices(services);
        
        // Validate that the createMultiple function was called with the correct parameters
        expect(mockCreateMultiple).toHaveBeenCalledWith(services.map(service => service.attributes), { returning: 'id', transaction: transactionObjectMock});
        expect(mockUpdateMultiple).not.toHaveBeenCalled();
    });

    it('should save services to the database, new and existing services', async () => {
        const services: Service[] = [new Service(serviceAttributes1, false), new Service(serviceAttributes2, true)];
        
        // Make the request to save the services
        await saveServices(services);
        
        // Validate that the createMultiple function was called with the correct parameters
        expect(mockCreateMultiple).toHaveBeenCalledWith([serviceAttributes2], { returning: 'id', transaction: transactionObjectMock});
        expect(mockUpdateMultiple).toHaveBeenCalledWith([serviceAttributes1], { returning: 'id', transaction: transactionObjectMock});
    });

    it('should save services to the database, new and existing services, with transaction', async () => {
        const currentTransaction = new Object(2) as any;
        expect(currentTransaction).not.toEqual(transactionObjectMock);
        const services: Service[] = [new Service(serviceAttributes1, false), new Service(serviceAttributes2, true)];
        
        // Make the request to save the services, with the transaction
        await saveServices(services,  { transaction: currentTransaction});
        
        // Validate that the createMultiple function was called with the correct parameters
        expect(mockCreateMultiple).toHaveBeenCalledWith([serviceAttributes2], { returning: 'id', transaction: currentTransaction});
        expect(mockUpdateMultiple).toHaveBeenCalledWith([serviceAttributes1], { returning: 'id', transaction: currentTransaction});
    });
    
    it('should handle errors when saving services to the database', async () => {
        const services: Service[] = [new Service(serviceAttributes2, true)];
        
        // Mock an error when saving the services
        mockCreateMultiple.mockRejectedValueOnce(new TrError('Database error', 'ERRCODE'));
        
        // Expect the saveServices function to throw an error
        await expect(saveServices(services)).rejects.toThrow('Database error');
        
        // Validate that the createMultiple function was called with the correct parameters
        expect(mockCreateMultiple).toHaveBeenCalledWith([serviceAttributes2], { returning: 'id', transaction: transactionObjectMock});
    });
});

describe('getUniqueServiceName', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return the name itself when no duplicate names exist', async () => {
        const serviceName = 'Service1';
        mockGetServiceNamesStartingWith.mockResolvedValueOnce([]);
        const uniqueName = await getUniqueServiceName(serviceName);
        expect(uniqueName).toBe(serviceName);
        expect(mockGetServiceNamesStartingWith).toHaveBeenCalledWith(serviceName, {});
    });

    it('should return the name itself when no duplicate names exist, with transaction', async () => {
        const currentTransaction = new Object(2) as any;
        const serviceName = 'Service1';
        mockGetServiceNamesStartingWith.mockResolvedValueOnce([]);
        const uniqueName = await getUniqueServiceName(serviceName, { transaction: currentTransaction});
        expect(uniqueName).toBe(serviceName);
        expect(mockGetServiceNamesStartingWith).toHaveBeenCalledWith(serviceName, { transaction: currentTransaction });
    });

    it('should return a unique name by adding a suffix when duplicate names exist', async () => {
        const serviceName = 'Service1';
        // Assume that a service with the same name already exists in the database
        mockGetServiceNamesStartingWith.mockResolvedValueOnce(['Service1', 'Service1-0']);

        const uniqueName = await getUniqueServiceName(serviceName);
        expect(uniqueName).not.toBe(serviceName);
        expect(uniqueName).toEqual("Service1-1");
        expect(mockGetServiceNamesStartingWith).toHaveBeenCalledWith(serviceName, {});
    });

    it('should handle errors when querying the database', async () => {
        const serviceName = 'Service1';
        // Assume that an error occurs when querying the database
        mockGetServiceNamesStartingWith.mockRejectedValueOnce(new Error('Database error'));

        await expect(getUniqueServiceName(serviceName)).rejects.toThrow('Database error');
        expect(mockGetServiceNamesStartingWith).toHaveBeenCalledWith(serviceName, {});
    });
});
