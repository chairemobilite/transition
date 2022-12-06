/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import _cloneDeep from 'lodash.clonedeep';

import {
    exists,
    read as defaultRead,
    create,
    createMultiple,
    update,
    updateMultiple,
    deleteRecord,
    deleteMultiple,
    truncate,
    destroy
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import {
    SimulationRunAttributes,
    SimulationRunDataAttributes,
    SimulationRuntimeOptions
} from 'transition-common/lib/services/simulation/SimulationRun';
import scenarioDbQueries from './transitScenarios.db.queries';

const tableName = 'tr_simulation_runs';
const runToScenarioTableName = 'tr_simulation_run_scenario';

const attributesCleaner = function (attributes: Partial<SimulationRunAttributes>) {
    const _attributes: any = _cloneDeep(attributes);
    delete _attributes.is_frozen;
    return _attributes;
};

type SimulationRunDbAttributes = {
    id: string;
    integer_id: number;
    internal_id: string;
    simulation_id: string;
    status: 'notStarted' | 'pending' | 'inProgress' | 'completed' | 'failed';
    data: SimulationRunDataAttributes;
    results?: { [key: string]: unknown } | null;
    seed?: string | null;
    options?: SimulationRuntimeOptions | null;
    started_at?: Date | null;
    completed_at?: Date | null;
};

const attributesParser = ({
    internal_id,
    results,
    seed,
    options,
    started_at,
    completed_at,
    ...rest
}: SimulationRunDbAttributes): Partial<SimulationRunAttributes> => ({
    internal_id: internal_id || undefined,
    completed_at: completed_at || undefined,
    started_at: started_at || undefined,
    options: options || undefined,
    seed: seed || undefined,
    results: results || undefined,
    ...rest
});

const getForSimulation = async (simulationId: string): Promise<Partial<SimulationRunAttributes>[]> => {
    try {
        const response = await knex
            .select('id', 'simulation_id', 'status', 'data', 'started_at', 'created_at', 'completed_at')
            .from(`${tableName}`)
            .where('simulation_id', simulationId)
            .orderBy('created_at', 'desc');

        return response.map(attributesParser);
    } catch (error) {
        throw new TrError(
            `cannot fetch simulation runs collection because of a database error (knex error: ${error})`,
            'TSIMRGQGC0002',
            'TransitSimulationRunCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const read = async (id: string) => {
    return await defaultRead<SimulationRunAttributes, SimulationRunDbAttributes>(
        knex,
        tableName,
        attributesParser,
        '*',
        id
    );
};

const saveSimulationRunScenarios = async (
    simulationRunId: string,
    scenarioIds: string[]
): Promise<{ [key: string]: any }[]> => {
    try {
        const currentScenarioIds = (
            await knex
                .select('scenario_id')
                .from(`${runToScenarioTableName}`)
                .where('simulation_run_id', simulationRunId)
        ).map((result) => result.scenario_id);
        const newScenarioIds = scenarioIds.filter((scenarioId) => !currentScenarioIds.includes(scenarioId));
        if (newScenarioIds.length !== 0) {
            return await knex
                .batchInsert(
                    runToScenarioTableName,
                    newScenarioIds.map((scenarioId) => ({
                        simulation_run_id: simulationRunId,
                        scenario_id: scenarioId
                    })),
                    100
                )
                .returning(['simulation_run_id']);
        }
        return [];
    } catch (error) {
        throw new TrError(
            `cannot save simulation runs to scenarios because of a database error (knex error: ${error})`,
            'TSIMRGQGC0003',
            'TransitSimulationRunScenarioCouldNotSaveBecauseDatabaseError'
        );
    }
};

/**
 * Delete the simulation run scenarios, and optionally, the now unused scenarios
 * after the deletion
 * @param simulationRunId The ID of the simulation run
 * @param scenarioIds The ids of the scenarios to delete from this run
 * @param deleteScenarios Whether to also delete the scenarios themselves
 * @returns Whether any scenario record was also deleted after deleting the
 * scenarios from the run
 */
const deleteSimulationRunScenarios = async (
    simulationRunId: string,
    scenarioIds?: string[],
    deleteScenarios = false
): Promise<boolean> => {
    try {
        // Get a list of scenario ids that should be deleted from the scenarios
        // table. They will be those for the current simulation id that have a
        // single occurrence in the run to scenario table
        let scenariosToDelete: any[] = [];
        if (deleteScenarios) {
            const innerQuery = knex
                .select('scenario_id')
                .from(runToScenarioTableName)
                .where('simulation_run_id', simulationRunId);
            if (scenarioIds !== undefined) {
                innerQuery.whereIn('scenario_id', scenarioIds);
            }
            const countScenariosQuery = knex
                .select('scenario_id')
                .from(runToScenarioTableName)
                .count()
                .whereIn('scenario_id', innerQuery)
                .groupBy('scenario_id')
                .as('scCount');
            scenariosToDelete = (await knex.select('scenario_id').from(countScenariosQuery).where('count', 1)).map(
                (simulationScenario) => simulationScenario.scenario_id
            );
        }

        // Delete the scenarios from the simulation_run_scenario table
        const deleteQuery = knex(runToScenarioTableName).where('simulation_run_id', simulationRunId);
        if (scenarioIds !== undefined) {
            deleteQuery.whereIn('scenario_id', scenarioIds);
        }
        await deleteQuery.del();

        if (scenariosToDelete.length > 0) {
            await scenarioDbQueries.deleteMultiple(scenariosToDelete, true);
            return true;
        }
        return false;
    } catch (error) {
        throw new TrError(
            `cannot delete simulation runs to scenarios because of a database error (knex error: ${error})`,
            'TSIMRGQGC0004',
            'TransitSimulationRunScenarioCouldNotDeleteBecauseDatabaseError'
        );
    }
};

const getScenarioIdsForRun = async (simulationRunId: string): Promise<string[]> => {
    try {
        return (
            await knex
                .select('scenario_id')
                .from(`${runToScenarioTableName}`)
                .where('simulation_run_id', simulationRunId)
        ).map((result) => result.scenario_id);
    } catch (error) {
        throw new TrError(
            `cannot get scenarios for run because of a database error (knex error: ${error})`,
            'TSIMRGQGC0005',
            'TransitSimulationRunCannotGetScenariosBecauseDatabaseError'
        );
    }
};

const cascadeDeleteScenario = async (id: string) => {
    try {
        const simRunScenarios = await getScenarioIdsForRun(id);
        if (simRunScenarios.length > 0) {
            await deleteSimulationRunScenarios(id, simRunScenarios, true);
        }
    } catch (error) {
        throw new TrError(
            `cannot delete scenarios for simulation run because of a database error (knex error: ${error})`,
            'TSIMRGQGC0003',
            'TransitSimulationRunCannotSetNullBecauseDatabaseError'
        );
    }
};

const deleteRun = async (id: string, cascade = false) => {
    if (cascade) {
        await cascadeDeleteScenario(id);
    }
    return deleteRecord(knex, tableName, id);
};

const deleteMultipleRun = async (ids: string[], cascade = false) => {
    if (cascade) {
        // cascade delete has to be called synchronously for each scenario, otherwise some scenarios do not get deleted if used by more than one run
        for (let i = 0; i < ids.length; i++) {
            await cascadeDeleteScenario(ids[i]);
        }
    }
    return deleteMultiple(knex, tableName, ids);
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: SimulationRunAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, returning);
    },
    createMultiple: (newObjects: SimulationRunAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<SimulationRunAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, returning);
    },
    updateMultiple: (updatedObjects: Partial<SimulationRunAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    },
    delete: deleteRun,
    deleteMultiple: deleteMultipleRun,
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    getForSimulation,
    saveSimulationRunScenarios,
    deleteSimulationRunScenarios,
    getScenarioIdsForRun
};
