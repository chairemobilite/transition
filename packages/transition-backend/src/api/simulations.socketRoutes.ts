/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import simulationDbQueries from '../models/db/simulations.db.queries';
import simulationRunsDbQueries from '../models/db/simulationRuns.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { SimulationAttributes } from 'transition-common/lib/services/simulation/Simulation';
import { SimulationRunAttributes } from 'transition-common/lib/services/simulation/SimulationRun';

/**
 * Add routes specific to simulations
 *
 * @export
 * @param {EventEmitter} socket The socket to register the routes to
 */
export default function (socket: EventEmitter) {
    socket.on('simulation.create', async (attributes: SimulationAttributes, callback) => {
        try {
            const returning = await simulationDbQueries.create(attributes);
            callback({
                id: returning
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error creating simulation' });
        }
    });

    // TODO Drop the cache path parameter once the callers don't use it. SaveUtils is now generic and includes this value
    socket.on('simulation.read', async (id: string, _customCachePath, callback) => {
        try {
            const object = await simulationDbQueries.read(id);
            callback({
                simulation: object
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error reading simulation' });
        }
    });

    socket.on('simulation.update', async (id: string, attributes: SimulationAttributes, callback) => {
        try {
            const updatedId = await simulationDbQueries.update(id, attributes);
            callback({
                id: updatedId
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error updating simulation' });
        }
    });

    // TODO Drop the cache path parameter once the callers don't use it. SaveUtils is now generic and includes this value
    socket.on('simulation.delete', async (id: string, _customCachePath, callback) => {
        try {
            const deletedId = await simulationDbQueries.delete(id);
            callback(Status.createOk({ id: deletedId }));
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.export() : 'Error deleting simulation'));
        }
    });

    socket.on('simulations.collection', async (_dataSourceId, callback) => {
        try {
            const collection = await simulationDbQueries.collection();
            callback({
                collection
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error retrieving simulations collection' });
        }
    });

    socket.on('simulation.getSimulationRuns', async (id: string, callback) => {
        try {
            const simulationRuns = await simulationRunsDbQueries.getForSimulation(id);
            callback({
                simulationRuns
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error retrieving simulations collection' });
        }
    });

    socket.on('simulationRun.create', async (attributes: SimulationRunAttributes, callback) => {
        try {
            const returning = await simulationRunsDbQueries.create(attributes);
            callback({
                id: returning
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error creating simulation run' });
        }
    });

    socket.on('simulationRun.update', async (id: string, attributes: SimulationRunAttributes, callback) => {
        try {
            const updatedId = await simulationRunsDbQueries.update(id, attributes);
            callback({
                id: updatedId
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error updating simulation run' });
        }
    });

    // TODO Drop the cache path parameter once the callers don't use it. SaveUtils is now generic and includes this value
    socket.on('simulationRun.read', async (id: string, _customCachePath, callback) => {
        try {
            const object = await simulationRunsDbQueries.read(id);
            callback({
                simulationRun: object
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error reading simulation run' });
        }
    });

    socket.on('simulationRun.delete', async (id: string, cascade: boolean, callback) => {
        try {
            const deletedId = await simulationRunsDbQueries.delete(id, cascade);
            callback({
                id: deletedId
            });
        } catch (error) {
            console.error(error);
            callback(TrError.isTrError(error) ? error.export() : { error: 'Error deleting simulation run' });
        }
    });
}
