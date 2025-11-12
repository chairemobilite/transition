/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import routes from '../simulations.socketRoutes';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import simulationsDbQueries from '../../models/db/simulations.db.queries';
import simulationsRunDbQueries from '../../models/db/simulationRuns.db.queries';

const socketStub = new EventEmitter();
routes(socketStub);

jest.mock('../../models/db/simulations.db.queries', () => {
    return {
        read: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        collection: jest.fn()
    }
});
jest.mock('../../models/db/simulationRuns.db.queries', () => {
    return {
        read: jest.fn(),
        create: jest.fn(),
        getForSimulation: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
});

const mockedRead = simulationsDbQueries.read as jest.MockedFunction<typeof simulationsDbQueries.read>;
const mockedCreate = simulationsDbQueries.create as jest.MockedFunction<typeof simulationsDbQueries.create>;
const mockedUpdate = simulationsDbQueries.update as jest.MockedFunction<typeof simulationsDbQueries.update>;
const mockedDelete = simulationsDbQueries.delete as jest.MockedFunction<typeof simulationsDbQueries.delete>;
const mockedCollection = simulationsDbQueries.collection as jest.MockedFunction<typeof simulationsDbQueries.collection>;
const mockedSimRunRead = simulationsRunDbQueries.read as jest.MockedFunction<typeof simulationsRunDbQueries.read>;
const mockedSimRunCreate = simulationsRunDbQueries.create as jest.MockedFunction<typeof simulationsRunDbQueries.create>;
const mockedSimRunUpdate = simulationsRunDbQueries.update as jest.MockedFunction<typeof simulationsRunDbQueries.update>;
const mockedSimRunDelete = simulationsRunDbQueries.delete as jest.MockedFunction<typeof simulationsRunDbQueries.delete>;
const mockedGetRunsFor = simulationsRunDbQueries.getForSimulation as jest.MockedFunction<typeof simulationsRunDbQueries.getForSimulation>;

const simulationAttributes1 = {
    id: uuidV4(),
    name: 'Simulation1',
    shortname: 'Sim1',
    description: 'This is a description',
    color: '#ff00ff',
    data: {
        routingAttributes: {
            maxTotalTravelTimeSeconds: 1000
        },
        simulationParameters: {
            maxTimeBetweenPassages: 15,
            nbOfVehicles: 9
        },
        algorithmConfiguration: {
            // Using 'test' as mock algorithm type, cast to any for test to work
            type: 'test' as any,
            config: {}
        }
    },
    isEnabled: true
};

const simulationAttributes2= {
    id: uuidV4(),
    name: 'Simulation2',
    description: 'descS2',
    color: '#ff0000',
    is_frozen: true,
    data: {
        routingAttributes: {},
        simulationParameters: {}
    },
    isEnabled: false
};

const simulationRunAttributes = {
    id: uuidV4(),
    status: 'notStarted' as const,
    seed: '1234',
    data: simulationAttributes1.data,
    simulation_id: simulationAttributes1.id
}

beforeEach(() => {
    mockedRead.mockClear();
    mockedCreate.mockClear();
    mockedUpdate.mockClear();
    mockedDelete.mockClear();
    mockedCollection.mockClear();
    mockedSimRunRead.mockClear;
    mockedSimRunCreate.mockClear();
    mockedGetRunsFor.mockClear();
    mockedSimRunUpdate.mockClear();
});

describe('Simulations: create', () => {

    test('Create correctly', (done) => {
        mockedCreate.mockResolvedValueOnce(simulationAttributes1.id);
        socketStub.emit('simulation.create', simulationAttributes1, (response) => {
            expect(mockedCreate).toHaveBeenCalledWith(simulationAttributes1);
            expect(response.id).toEqual(simulationAttributes1.id);
            done();
        });
    });

    test('Create with error', (done) => {
        const message = 'Error while creating';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedCreate.mockRejectedValueOnce(error);
        socketStub.emit('simulation.create', simulationAttributes1, function (response) {
            expect(mockedCreate).toHaveBeenCalledWith(simulationAttributes1);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulations: update', () => {

    test('Update correctly', (done) => {
        mockedUpdate.mockResolvedValueOnce(simulationAttributes1.id);
        socketStub.emit('simulation.update', simulationAttributes1.id, simulationAttributes1, (response) => {
            expect(mockedUpdate).toHaveBeenCalledWith(simulationAttributes1.id, simulationAttributes1);
            expect(response.id).toEqual(simulationAttributes1.id);
            done();
        });
    });

    test('Update with error', (done) => {
        const message = 'Error while updating';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedUpdate.mockRejectedValueOnce(error);
        socketStub.emit('simulation.update', simulationAttributes1.id, simulationAttributes1, function (response) {
            expect(mockedUpdate).toHaveBeenCalledWith(simulationAttributes1.id, simulationAttributes1);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulations: read', () => {

    test('Read correctly', (done) => {
        mockedRead.mockResolvedValueOnce(simulationAttributes1);
        socketStub.emit('simulation.read', simulationAttributes1.id, undefined, (response) => {
            expect(mockedRead).toHaveBeenCalledWith(simulationAttributes1.id);
            expect(response.simulation).toEqual(simulationAttributes1);
            done();
        });
    });

    test('Read with error', (done) => {
        const message = 'Error while updating';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedRead.mockRejectedValueOnce(error);
        socketStub.emit('simulation.read', simulationAttributes1.id, undefined, function (response) {
            expect(mockedRead).toHaveBeenCalledWith(simulationAttributes1.id);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulations: delete', () => {

    test('Delete correctly', (done) => {
        mockedDelete.mockResolvedValueOnce(simulationAttributes1.id);
        socketStub.emit('simulation.delete', simulationAttributes1.id, undefined, (response) => {
            expect(mockedDelete).toHaveBeenCalledWith(simulationAttributes1.id);
            expect(Status.isStatusOk(response)).toBe(true);
            expect(Status.unwrap(response)).toEqual({ id: simulationAttributes1.id });
            done();
        });
    });

    test('Delete with error', (done) => {
        const message = 'Error while deleting';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedDelete.mockRejectedValueOnce(error);
        socketStub.emit('simulation.delete', simulationAttributes1.id, undefined, function (response) {
            expect(mockedDelete).toHaveBeenCalledWith(simulationAttributes1.id);
            expect(Status.isStatusOk(response)).toBe(false);
            expect(response.error.error).toEqual(message);
            expect(response.error.localizedMessage).toEqual(localizedMessage);
            expect(response.error.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulations: collections', () => {

    test('Get collection correctly', (done) => {
        mockedCollection.mockResolvedValueOnce([ simulationAttributes1, simulationAttributes2 ]);
        socketStub.emit('simulations.collection', uuidV4(), (response) => {
            expect(mockedCollection).toHaveBeenCalledTimes(1);
            expect(response.collection).toEqual([ simulationAttributes1, simulationAttributes2 ]);
            done();
        });
    });

    test('Get collection with error', (done) => {
        const message = 'Error while getting collection';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedCollection.mockRejectedValueOnce(error);
        socketStub.emit('simulations.collection', uuidV4(), function (response) {
            expect(mockedCollection).toHaveBeenCalledTimes(1);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulation runs: create', () => {

    test('Create correctly', (done) => {
        mockedSimRunCreate.mockResolvedValueOnce(simulationRunAttributes.id);
        socketStub.emit('simulationRun.create', simulationRunAttributes, (response) => {
            expect(mockedSimRunCreate).toHaveBeenCalledWith(simulationRunAttributes);
            expect(response.id).toEqual(simulationRunAttributes.id);
            done();
        });
    });

    test('Create with error', (done) => {
        const message = 'Error while creating';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedSimRunCreate.mockRejectedValueOnce(error);
        socketStub.emit('simulationRun.create', simulationRunAttributes, function (response) {
            expect(mockedSimRunCreate).toHaveBeenCalledWith(simulationRunAttributes);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulation runs: update', () => {

    test('Update correctly', (done) => {
        mockedSimRunUpdate.mockResolvedValueOnce(simulationRunAttributes.id);
        socketStub.emit('simulationRun.update', simulationRunAttributes.id, simulationRunAttributes, (response) => {
            expect(mockedSimRunUpdate).toHaveBeenCalledWith(simulationRunAttributes.id, simulationRunAttributes);
            expect(response.id).toEqual(simulationRunAttributes.id);
            done();
        });
    });

    test('Update with error', (done) => {
        const message = 'Error while updating';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedSimRunUpdate.mockRejectedValueOnce(error);
        socketStub.emit('simulationRun.update', simulationRunAttributes.id, simulationRunAttributes, function (response) {
            expect(mockedSimRunUpdate).toHaveBeenCalledWith(simulationRunAttributes.id, simulationRunAttributes);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulation runs: read', () => {

    test('Read correctly', (done) => {
        mockedSimRunRead.mockResolvedValueOnce(simulationRunAttributes);
        socketStub.emit('simulationRun.read', simulationRunAttributes.id, undefined, (response) => {
            expect(mockedSimRunRead).toHaveBeenCalledWith(simulationRunAttributes.id);
            expect(response.simulationRun).toEqual(simulationRunAttributes);
            done();
        });
    });

    test('Read with error', (done) => {
        const message = 'Error while updating';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedSimRunRead.mockRejectedValueOnce(error);
        socketStub.emit('simulationRun.read', simulationRunAttributes.id, undefined, function (response) {
            expect(mockedSimRunRead).toHaveBeenCalledWith(simulationRunAttributes.id);
            expect(response.simulationRun).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulation runs: get for simulation', () => {

    test('Get runs correctly', (done) => {
        mockedGetRunsFor.mockResolvedValueOnce([ simulationRunAttributes ]);
        socketStub.emit('simulation.getSimulationRuns', simulationAttributes1.id, (response) => {
            expect(mockedGetRunsFor).toHaveBeenCalledTimes(1);
            expect(response.simulationRuns).toEqual([ simulationRunAttributes ]);
            done();
        });
    });

    test('Get runs with error', (done) => {
        const message = 'Error while getting collection';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedGetRunsFor.mockRejectedValueOnce(error);
        socketStub.emit('simulation.getSimulationRuns', uuidV4(), function (response) {
            expect(mockedGetRunsFor).toHaveBeenCalledTimes(1);
            expect(response.simulationRuns).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Simulation runs: delete', () => {

    test('Delete correctly', (done) => {
        mockedSimRunDelete.mockResolvedValueOnce(simulationRunAttributes.id);
        socketStub.emit('simulationRun.delete', simulationRunAttributes.id, true, (response) => {
            expect(mockedSimRunDelete).toHaveBeenCalledWith(simulationRunAttributes.id, true);
            expect(response.id).toEqual(simulationRunAttributes.id);
            done();
        });
    });

    test('Delete correctly without cascade', (done) => {
        mockedSimRunDelete.mockResolvedValueOnce(simulationRunAttributes.id);
        socketStub.emit('simulationRun.delete', simulationRunAttributes.id, false, (response) => {
            expect(mockedSimRunDelete).toHaveBeenCalledWith(simulationRunAttributes.id, false);
            expect(response.id).toEqual(simulationRunAttributes.id);
            done();
        });
    });

    test('Delete with error', (done) => {
        const message = 'Error while deleting';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedSimRunDelete.mockRejectedValueOnce(error);
        socketStub.emit('simulationRun.delete', simulationRunAttributes.id, false, function (response) {
            expect(mockedSimRunDelete).toHaveBeenCalledWith(simulationRunAttributes.id, false);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});
