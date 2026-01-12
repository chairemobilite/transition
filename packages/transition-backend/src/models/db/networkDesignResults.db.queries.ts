/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import { truncate, destroy } from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { ResultSerialization } from '../../services/evolutionaryAlgorithm/candidate/types';

const tableName = 'tr_jobs_network_design_results';
const simulationMethodTableName = 'tr_jobs_network_design_simulation_results';
const candidateLinesTableName = 'tr_jobs_network_design_candidate_lines';
const linesTbl = 'tr_transit_lines';
const pathsTbl = 'tr_transit_paths';

type CandidateResultForDb = {
    jobId: number;
    generationIndex: number;
    candidateIndex: number;
    scenarioName: string;
    resultData: ResultSerialization;
};

const create = async (candidateResult: CandidateResultForDb): Promise<void> => {
    try {
        // Save the candidate result
        const candidateResultId = await knex(tableName)
            .insert({
                job_id: candidateResult.jobId,
                generation_index: candidateResult.generationIndex,
                candidate_index: candidateResult.candidateIndex,
                total_fitness: candidateResult.resultData.result.totalFitness,
                data: { scenarioName: candidateResult.scenarioName }
            })
            .returning('id');
        const candidateResultIdValue = candidateResultId[0].id;

        // Save the lines data
        const candidateLines = Object.entries(candidateResult.resultData.lines).map(([lineId, lineData]) => ({
            candidate_id: candidateResultIdValue,
            line_id: lineId,
            number_of_vehicles: lineData.nbVehicles,
            time_between_passages: lineData.timeBetweenPassages,
            outbound_path_id: lineData.outboundPathId,
            inbound_path_id: lineData.inboundPathId || null,
            data: lineData
        }));
        await knex(candidateLinesTableName).insert(candidateLines);

        // Save the score data
        const candidateSimulationResults = Object.entries(candidateResult.resultData.result.results).map(
            ([simulationMethod, methodResults]) => ({
                candidate_id: candidateResultIdValue,
                simulation_method: simulationMethod,
                fitness_score: methodResults.fitness,
                data: methodResults.results
            })
        );
        await knex(simulationMethodTableName).insert(candidateSimulationResults);
    } catch (error) {
        throw new TrError(
            `Cannot insert result ${candidateResult.generationIndex}/${candidateResult.candidateIndex} for job ${candidateResult.jobId} in database (knex error: ${error})`,
            'DBNDGAL0001',
            'DatabaseCannotCreateBecauseDatabaseError'
        );
    }
};

const streamCandidatesLinesData = (jobId: number) => {
    try {
        const candidateLinesQuery = knex
            .select(
                `${tableName}.total_fitness`,
                `${tableName}.generation_index`,
                `${tableName}.candidate_index`,
                `${tableName}.data as candidate_data`,
                `${candidateLinesTableName}.line_id`,
                `${candidateLinesTableName}.number_of_vehicles`,
                `${candidateLinesTableName}.data as line_data`,
                `${candidateLinesTableName}.outbound_path_id`,
                `${candidateLinesTableName}.inbound_path_id`,
                `${candidateLinesTableName}.time_between_passages`,
                `${linesTbl}.shortname`,
                `${linesTbl}.longname`,
                'outbound_path.data as outbound_path_data',
                'inbound_path.data as inbound_path_data'
            )
            .from(tableName)
            .innerJoin(candidateLinesTableName, `${tableName}.id`, '=', `${candidateLinesTableName}.candidate_id`)
            .innerJoin(linesTbl, `${candidateLinesTableName}.line_id`, '=', `${linesTbl}.id`)
            .leftJoin(
                `${pathsTbl} as outbound_path`,
                `${candidateLinesTableName}.outbound_path_id`,
                '=',
                'outbound_path.id'
            )
            .leftJoin(
                `${pathsTbl} as inbound_path`,
                `${candidateLinesTableName}.inbound_path_id`,
                '=',
                'inbound_path.id'
            )
            .where('job_id', jobId)
            .orderBy([`${tableName}.generation_index`, 'total_fitness']);

        return candidateLinesQuery.stream();
    } catch (error) {
        throw new TrError(
            `cannot fetch candidate lines data stream because of a database error (knex error: ${error})`,
            'DBNDGAL0004',
            'CandidateLinesDataCouldNotBeStreamedBecauseDatabaseError'
        );
    }
};

const streamSimulationResults = (jobId: number) => {
    try {
        const candidateLinesQuery = knex
            .select(
                `${tableName}.total_fitness`,
                `${tableName}.generation_index`,
                `${tableName}.candidate_index`,
                `${tableName}.data as candidate_data`,
                `${simulationMethodTableName}.*`
            )
            .from(tableName)
            .innerJoin(simulationMethodTableName, `${tableName}.id`, '=', `${simulationMethodTableName}.candidate_id`)
            .where('job_id', jobId)
            .orderBy([`${tableName}.generation_index`, 'total_fitness']);

        return candidateLinesQuery.stream();
    } catch (error) {
        throw new TrError(
            `cannot fetch candidate simulation results data stream because of a database error (knex error: ${error})`,
            'DBNDGAL0005',
            'CandidateSimulationResultsDataCouldNotBeStreamedBecauseDatabaseError'
        );
    }
};

/**
 * Delete the results for a specific job
 *
 * @param jobId The ID of the job for which to delete
 * @param tripIndex The index of the trip result from which to delete the
 * results. If specified, only the results with indexes greater or equal to this
 * index will be deleted.
 */
const deleteForJob = async (jobId: number, generationIndex?: number): Promise<void> => {
    try {
        const deleteQuery = knex(tableName).delete().where('job_id', jobId);
        if (generationIndex !== undefined) {
            deleteQuery.andWhere('generation_index', '>=', generationIndex);
        }
        await deleteQuery;
    } catch (error) {
        throw new TrError(
            `Cannot delete results for job ${jobId} in table ${tableName} database (knex error: ${error})`,
            'DBNDGAL0003',
            'DatabaseCannotDeleteBecauseDatabaseError'
        );
    }
};

export default {
    create,
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    deleteForJob,
    streamCandidatesLinesData,
    streamSimulationResults
};
