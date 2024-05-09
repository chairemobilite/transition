/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import Service from 'transition-common/lib/services/service/Service';
import { duplicateServices } from '../ServiceDuplicator';
import { getServicesById, getUniqueServiceName, saveServices } from '../ServiceUtils';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import * as Status from 'chaire-lib-common/lib/utils/Status';

// Mock the knex transaction object.
const transactionObjectMock = new Object(3);

jest.mock('chaire-lib-backend/lib/config/shared/db.config', () => {
    const originalModule =
        jest.requireActual<typeof import('chaire-lib-backend/lib/config/shared/db.config')>('chaire-lib-backend/lib/config/shared/db.config');

    return {
        ...originalModule,
        transaction: jest.fn().mockImplementation(async (callback) => await callback(transactionObjectMock))
    };
});

// Mock the ServiceUtils module
const defaultSuffix = '-0';
jest.mock('../ServiceUtils', () => ({
    getUniqueServiceName: jest.fn().mockImplementation((name) => name + defaultSuffix),
    getServicesById: jest.fn().mockImplementation((serviceIds) => 
        serviceIds.map((id: string) => id === serviceAttributes1.id 
            ? new Service(serviceAttributes1, false) 
            : id === serviceAttributes2.id ? new Service(serviceAttributes2, false) : undefined)
        .filter((service) => service !== undefined)),
    saveServices: jest.fn().mockResolvedValue(undefined)
}));
const mockGetUniqueServiceName = getUniqueServiceName as jest.MockedFunction<typeof getUniqueServiceName>;
const mockGetServicesById = getServicesById as jest.MockedFunction<typeof getServicesById>;
const mockSaveServices = saveServices as jest.MockedFunction<typeof saveServices>;

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

const serviceAttributes2 = {
    id: uuidV4(),
    name: 'Service2',
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

describe('duplicateAndSaveServices', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should duplicate and save a service with default options', async () => {
        // Duplicate and save the service
        const duplicateStatus = await duplicateServices([serviceAttributes1.id, serviceAttributes2.id], {});
        expect(Status.isStatusOk(duplicateStatus)).toEqual(true);
        const duplicatedServiceMapping = Status.unwrap(duplicateStatus);
        expect(Object.keys(duplicatedServiceMapping).length).toEqual(2);

        // Validate the inner calls
        expect(mockGetUniqueServiceName).toHaveBeenCalledWith(serviceAttributes1.name, { transaction: transactionObjectMock });
        expect(mockGetUniqueServiceName).toHaveBeenCalledWith(serviceAttributes2.name, { transaction: transactionObjectMock });
        expect(mockGetServicesById).toHaveBeenCalledWith([serviceAttributes1.id, serviceAttributes2.id], { transaction: transactionObjectMock })
        expect(mockSaveServices).toHaveBeenCalledTimes(1);
        expect(mockSaveServices).toHaveBeenCalledWith(expect.anything(), { transaction: transactionObjectMock });
        const savedServices = mockSaveServices.mock.calls[0][0];
        expect(savedServices.length).toEqual(2);
        const firstDuplicatedService = savedServices.find((service) => service.attributes.id === duplicatedServiceMapping[serviceAttributes1.id]);
        expect(firstDuplicatedService).toBeDefined();
        expect((firstDuplicatedService as Service).attributes).toEqual(expect.objectContaining({
            ...serviceAttributes1,
            id: duplicatedServiceMapping[serviceAttributes1.id],
            name: serviceAttributes1.name + defaultSuffix
        }));
        const secondDuplicatedService = savedServices.find((service) => service.attributes.id === duplicatedServiceMapping[serviceAttributes2.id]);
        expect(secondDuplicatedService).toBeDefined();
        expect((secondDuplicatedService as Service).attributes).toEqual(expect.objectContaining({
            ...serviceAttributes2,
            id: duplicatedServiceMapping[serviceAttributes2.id],
            name: serviceAttributes2.name + defaultSuffix
        }));
    });

    it('should duplicate and save a service with default options and transaction', async () => {
        const currentTransaction = new Object(2) as any;
        expect(currentTransaction).not.toEqual(transactionObjectMock);

        // Duplicate and save the service
        const duplicateStatus = await duplicateServices([serviceAttributes1.id, serviceAttributes2.id], { transaction: currentTransaction});
        expect(Status.isStatusOk(duplicateStatus)).toEqual(true);
        const duplicatedServiceMapping = Status.unwrap(duplicateStatus);
        expect(Object.keys(duplicatedServiceMapping).length).toEqual(2);

        // Validate the inner calls
        expect(mockGetUniqueServiceName).toHaveBeenCalledWith(serviceAttributes1.name, { transaction: currentTransaction });
        expect(mockGetUniqueServiceName).toHaveBeenCalledWith(serviceAttributes2.name, { transaction: currentTransaction });
        expect(mockGetServicesById).toHaveBeenCalledWith([serviceAttributes1.id, serviceAttributes2.id], { transaction: currentTransaction })
        expect(mockSaveServices).toHaveBeenCalledTimes(1);
        expect(mockSaveServices).toHaveBeenCalledWith(expect.anything(), { transaction: currentTransaction })
        const savedServices = mockSaveServices.mock.calls[0][0];
        expect(savedServices.length).toEqual(2);
        const firstDuplicatedService = savedServices.find((service) => service.attributes.id === duplicatedServiceMapping[serviceAttributes1.id]);
        expect(firstDuplicatedService).toBeDefined();
        expect((firstDuplicatedService as Service).attributes).toEqual(expect.objectContaining({
            ...serviceAttributes1,
            id: duplicatedServiceMapping[serviceAttributes1.id],
            name: serviceAttributes1.name + defaultSuffix
        }));
        const secondDuplicatedService = savedServices.find((service) => service.attributes.id === duplicatedServiceMapping[serviceAttributes2.id]);
        expect(secondDuplicatedService).toBeDefined();
        expect((secondDuplicatedService as Service).attributes).toEqual(expect.objectContaining({
            ...serviceAttributes2,
            id: duplicatedServiceMapping[serviceAttributes2.id],
            name: serviceAttributes2.name + defaultSuffix
        }));
    });

    it('should duplicate and save a service with a new service suffix', async () => {
        const newServiceSuffix = '_copy';

        // Duplicate and save the service
        const duplicateStatus = await duplicateServices([serviceAttributes1.id, serviceAttributes2.id], { newServiceSuffix });
        expect(Status.isStatusOk(duplicateStatus)).toEqual(true);
        const duplicatedServiceMapping = Status.unwrap(duplicateStatus);
        expect(Object.keys(duplicatedServiceMapping).length).toEqual(2);

        // Validate the inner calls
        expect(mockGetUniqueServiceName).toHaveBeenCalledWith(serviceAttributes1.name + newServiceSuffix, { transaction: transactionObjectMock });
        expect(mockGetUniqueServiceName).toHaveBeenCalledWith(serviceAttributes2.name + newServiceSuffix, { transaction: transactionObjectMock });
        expect(mockGetServicesById).toHaveBeenCalledWith([serviceAttributes1.id, serviceAttributes2.id], { transaction: transactionObjectMock })
        expect(mockSaveServices).toHaveBeenCalledTimes(1);
        expect(mockSaveServices).toHaveBeenCalledWith(expect.anything(), { transaction: transactionObjectMock });
        const savedServices = mockSaveServices.mock.calls[0][0];
        expect(savedServices.length).toEqual(2);
        const firstDuplicatedService = savedServices.find((service) => service.attributes.id === duplicatedServiceMapping[serviceAttributes1.id]);
        expect(firstDuplicatedService).toBeDefined();
        expect((firstDuplicatedService as Service).attributes).toEqual(expect.objectContaining({
            ...serviceAttributes1,
            id: duplicatedServiceMapping[serviceAttributes1.id],
            name: serviceAttributes1.name + newServiceSuffix + defaultSuffix
        }));
        const secondDuplicatedService = savedServices.find((service) => service.attributes.id === duplicatedServiceMapping[serviceAttributes2.id]);
        expect(secondDuplicatedService).toBeDefined();
        expect((secondDuplicatedService as Service).attributes).toEqual(expect.objectContaining({
            ...serviceAttributes2,
            id: duplicatedServiceMapping[serviceAttributes2.id],
            name: serviceAttributes2.name + newServiceSuffix + defaultSuffix
        }));
    });

    it('should return an error if an exception occurred while saving', async () => {
        // Reject the save operation
        const error = 'Error while saving';
        mockSaveServices.mockRejectedValueOnce(new TrError(error, 'ERRORSAVING'));

        // Duplicate the service
        const duplicateStatus = await duplicateServices([serviceAttributes1.id], { });
        expect(Status.isStatusError(duplicateStatus)).toEqual(true);
        expect(mockSaveServices).toHaveBeenCalledTimes(1);
    });

    it('should return an error if an exception occurred while duplicating', async () => {
        // Reject the duplication operation
        const error = 'Error while fetching services';
        mockGetServicesById.mockRejectedValueOnce(new TrError(error, 'ERRORFETCHING'));

        // Duplicate the service
        const duplicateStatus = await duplicateServices([serviceAttributes1.id], { });
        expect(Status.isStatusError(duplicateStatus)).toEqual(true);
        expect(mockGetServicesById).toHaveBeenCalled();
        expect(mockSaveServices).not.toHaveBeenCalled();
    });

    it('should not duplicate the service if there is an error getting unique name', async () => {
        // Reject the duplication operation
        const error = 'Error while fetching services';
        mockGetUniqueServiceName.mockRejectedValueOnce(new TrError(error, 'ERRORGETTINGUNIQUE'));

        // Duplicate the service
        const duplicateStatus = await duplicateServices([serviceAttributes1.id], { });
        expect(Status.isStatusError(duplicateStatus)).toEqual(true);
        expect(mockGetServicesById).toHaveBeenCalled();
        expect(mockSaveServices).not.toHaveBeenCalled();
    });
});
