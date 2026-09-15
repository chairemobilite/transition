/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import dbQueries from '../networkDesignResults.db.queries';
import jobsDbQueries from '../jobs.db.queries';
import { userAuthModel } from 'chaire-lib-backend/lib/services/auth/userAuthModel';
import { JobAttributes } from 'transition-common/lib/services/jobs/Job';
import linesDbQueries from '../transitLines.db.queries';
import agencyDbQueries from '../transitAgencies.db.queries'
import pathDbQueries from '../transitPaths.db.queries';

const tableName = 'tr_jobs_network_design_results';
const simulationMethodTableName = 'tr_jobs_network_design_simulation_results';
const candidateLinesTableName = 'tr_jobs_network_design_candidate_lines';

// Use a test job, no need to configure all the parameters of the main job type
type TestJobType = {
    name: 'test';
    data: {
        parameters: {
            foo: string
        };
    },
    files: { }
}

const data = { name: 'test' as const, data: { parameters: { foo: 'bar' } } } as TestJobType;

// Create a user to own the job
const userAttributes = {
    id: 3,
    uuid: uuidV4(),
    username: 'test'
}

const jobAttributes: Omit<JobAttributes<TestJobType>, 'id'> = {
    status: 'pending' as const,
    name: 'test' as const,
    user_id: userAttributes.id,
    data: data.data,
    internal_data: {}
};

// Current ids in the DB for the various test objects to use throughout the tests
let jobId: number | undefined = undefined;
let jobId2: number | undefined = undefined;
const agencyId = uuidV4();
const lineId1 = uuidV4();
const lineId2 = uuidV4();
const lineId3 = uuidV4();
// Add paths, only lines 1 has inbound and outbound paths for testing
const outboundPathLine1Id = uuidV4();
const inboundPathLine1Id = uuidV4();
const outboundPathLine2Id = uuidV4();
const outboundPathLine3Id = uuidV4();

// Path data objects for testing
const outboundPathLine1Data = {
    operatingTimeWithoutLayoverTimeSeconds: 600
};
const inboundPathLine1Data = {
    operatingTimeWithoutLayoverTimeSeconds: 800
};
const outboundPathLine2Data = {
    operatingTimeWithoutLayoverTimeSeconds: 900
};
const outboundPathLine3Data = {
    operatingTimeWithoutLayoverTimeSeconds: 1000
};

const candidateResult1 = {
    lines: {
        [lineId1]: { nbVehicles: 2, shortname: 'lineId1', timeBetweenPassages: 10, outboundPathId: outboundPathLine1Id, inboundPathId: inboundPathLine1Id },
        [lineId2]: { nbVehicles: 3, shortname: 'lineId2', timeBetweenPassages: 15, outboundPathId: outboundPathLine2Id }
    },
    numberOfVehicles: 5,
    numberOfLines: 2,
    result: {
        totalFitness: 123.45,
        results: {
            OdTripSimulation: { fitness: 100, results: { routedCount: 100, nonRoutedCount: 24} },
        }
    }
};

const candidateResult2 = {
    lines: {
        [lineId1]: { nbVehicles: 3, shortname: 'lineId1', timeBetweenPassages: 8, outboundPathId: outboundPathLine1Id, inboundPathId: inboundPathLine1Id },
        [lineId3]: { nbVehicles: 2, shortname: 'lineId3', timeBetweenPassages: 20, outboundPathId: outboundPathLine3Id }
    },
    numberOfVehicles: 5,
    numberOfLines: 2,
    result: {
        totalFitness: 54.321,
        results: {
            OdTripSimulation: { fitness: 89, results: { routedCount: 100, nonRoutedCount: 24} },
        }
    }
};



beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await jobsDbQueries.truncate();
    await linesDbQueries.truncate();
    await agencyDbQueries.truncate();
    await pathDbQueries.truncate();
    await knex.raw(`TRUNCATE TABLE users CASCADE`);
    const user = await userAuthModel.createAndSave(userAttributes);
    userAttributes.id = user.attributes.id;
    jobAttributes.user_id = userAttributes.id;
    // Create 2 jobs to use their IDs in tests
    jobId = await jobsDbQueries.create(jobAttributes);
    jobId2 = await jobsDbQueries.create(jobAttributes);
    await agencyDbQueries.create({
        id: agencyId
    } as any);
    await linesDbQueries.create({
        id: lineId1,
        agency_id: agencyId,
        shortname: 'lineId1',
        longname: 'Line 1',
        color: '#ffffff',
    } as any);
    await linesDbQueries.create({
        id: lineId2,
        agency_id: agencyId,
        shortname: 'lineId2',
        longname: 'Line 2',
        color: '#ffffff',
    } as any);
    await linesDbQueries.create({
        id: lineId3,
        agency_id: agencyId,
        shortname: 'lineId3',
        longname: 'Line 3',
        color: '#ffffff',
    } as any);
    // Add paths, with minimal data
    await pathDbQueries.create({
        id: outboundPathLine1Id,
        line_id: lineId1,
        direction: 'outbound',
        name: 'Outbound Path Line 1',
        data: outboundPathLine1Data
    } as any);
    await pathDbQueries.create({
        id: inboundPathLine1Id,
        line_id: lineId1,
        direction: 'inbound',
        name: 'Inbound Path Line 1',
        data: inboundPathLine1Data
    } as any);
    await pathDbQueries.create({
        id: outboundPathLine2Id,
        line_id: lineId2,
        direction: 'loop',
        name: 'Outbound Path Line 2',
        data: outboundPathLine2Data
    } as any);
    await pathDbQueries.create({
        id: outboundPathLine3Id,
        line_id: lineId3,
        direction: 'loop',
        name: 'Outbound Path Line 3',
        data: outboundPathLine3Data
    } as any);
});

afterAll(async() => {
    await dbQueries.truncate();
    await jobsDbQueries.truncate();
    await knex.raw(`TRUNCATE TABLE users CASCADE`);
    await knex.destroy();
});

describe(`sequential creation/querying`, () => {

    test('should create a new object in database', async() => {

        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 0,
            scenarioName: 'Scenario 0_0',
            resultData: candidateResult1
        });

    });

    test('should create another new object in database', async() => {

        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 1,
            scenarioName: 'Scenario 0_1',
            resultData: candidateResult2
        });

    });

    test('should not be able to create the same object twice', async() => {

        await expect(dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 0,
            scenarioName: 'Scenario 0_1',
            resultData: candidateResult1
        })).rejects.toThrow();

    });

    test('should stream the lines data for a job', (done) => {
        const candidateLinesResults: any[] = [];
        const stream = dbQueries.streamCandidatesLinesData(jobId as number);
        stream
            .on('error', (error) => {
                expect(error).toEqual('success');
                done();
            })
            .on('data', (row) => {
                candidateLinesResults.push(row);
            })
            .on('end', () => {
                // Should be 4 lines
                expect(candidateLinesResults.length).toEqual(4);

                // Validate that the generation_index and total_fitness for each line are superior or equal to previous line
                let previousGenerationIndex = -1;
                let previousTotalFitness = -1;
                for (const row of candidateLinesResults) {
                    const generationIndex = row['generation_index'];
                    const totalFitness = parseFloat(row['total_fitness']);
                    expect(generationIndex).toBeGreaterThanOrEqual(previousGenerationIndex);
                    if (generationIndex === previousGenerationIndex) {
                        expect(totalFitness).toBeGreaterThanOrEqual(previousTotalFitness);
                    }
                    previousGenerationIndex = generationIndex;
                    previousTotalFitness = totalFitness;
                }

                // Validate the data for each candidate
                const candidate1Lines = candidateLinesResults.filter(r => r['generation_index'] === 0 && r['candidate_index'] === 0);
                expect(candidate1Lines.length).toEqual(2);
                const candidateLine1 = candidate1Lines.find(r => r['line_id'] === lineId1);
                expect(candidateLine1).toBeDefined();
                expect(candidateLine1).toEqual(expect.objectContaining({
                    total_fitness: "123.45", line_id: lineId1, number_of_vehicles: 2, time_between_passages: '10.00', shortname: 'lineId1', longname: 'Line 1', candidate_data: { scenarioName: 'Scenario 0_0' }, outbound_path_id: outboundPathLine1Id, inbound_path_id: inboundPathLine1Id, outbound_path_data: outboundPathLine1Data, inbound_path_data: inboundPathLine1Data
                }));
                
                const candidateLine2 = candidate1Lines.find(r => r['line_id'] === lineId2);
                expect(candidateLine2).toBeDefined();
                expect(candidateLine2).toEqual(expect.objectContaining({ 
                    total_fitness: "123.45", line_id: lineId2, number_of_vehicles: 3, time_between_passages: '15.00', shortname: 'lineId2', longname: 'Line 2', outbound_path_id: outboundPathLine2Id, inbound_path_id: null, candidate_data: { scenarioName: 'Scenario 0_0' }, outbound_path_data: outboundPathLine2Data, inbound_path_data: null 
                }));

                const candidate2Lines = candidateLinesResults.filter(r => r['generation_index'] === 0 && r['candidate_index'] === 1);
                expect(candidate2Lines.length).toEqual(2);
                
                const candidate2Line1 = candidate2Lines.find(r => r['line_id'] === lineId1);
                expect(candidate2Line1).toBeDefined();
                expect(candidate2Line1).toEqual(expect.objectContaining({ 
                    total_fitness: "54.32", line_id: lineId1, number_of_vehicles: 3, time_between_passages: '8.00', shortname: 'lineId1', longname: 'Line 1', candidate_data: { scenarioName: 'Scenario 0_1' }, outbound_path_id: outboundPathLine1Id, inbound_path_id: inboundPathLine1Id, outbound_path_data: outboundPathLine1Data, inbound_path_data: inboundPathLine1Data 
                }));
                
                const candidate2Line3 = candidate2Lines.find(r => r['line_id'] === lineId3);
                expect(candidate2Line3).toBeDefined();
                expect(candidate2Line3).toEqual(expect.objectContaining({ 
                    total_fitness: "54.32", line_id: lineId3, number_of_vehicles: 2, time_between_passages: '20.00', shortname: 'lineId3', longname: 'Line 3', outbound_path_id: outboundPathLine3Id, inbound_path_id: null, candidate_data: { scenarioName: 'Scenario 0_1' }, outbound_path_data: outboundPathLine3Data, inbound_path_data: null 
                }));
                done();
            });
    });

    test('should stream empty data if job has no data', (done) => {
        const candidateLinesResults: any[] = [];
        // Stream for joId2, there are no results yet
        const stream = dbQueries.streamCandidatesLinesData(jobId2 as number);
        stream
            .on('error', (error) => {
                expect(error).toEqual('success');
                done();
            })
            .on('data', (row) => {
                candidateLinesResults.push(row);
            })
            .on('end', () => {
                expect(candidateLinesResults.length).toEqual(0);
                done();
            });
    });

    test('should stream empty data if job does not exist', (done) => {
        const candidateLinesResults: any[] = [];
        // Stream for a job ID that does not exist
        const stream = dbQueries.streamCandidatesLinesData(jobId2 as number + 1);
        stream
            .on('error', (error) => {
                expect(error).toEqual('success');
                done();
            })
            .on('data', (row) => {
                candidateLinesResults.push(row);
            })
            .on('end', () => {
                expect(candidateLinesResults.length).toEqual(0);
                done();
            });
    });

    test('should stream the results detail by simulation method for job', (done) => {
        const simulationResults: any[] = [];
        const stream = dbQueries.streamSimulationResults(jobId as number);
        stream
            .on('error', (error) => {
                expect(error).toEqual('success');
                done();
            })
            .on('data', (row) => {
                simulationResults.push(row);
            })
            .on('end', () => {
                // Should be 4 lines
                expect(simulationResults.length).toEqual(2);

                // Validate that the generation_index and total_fitness for each line are superior or equal to previous line
                let previousGenerationIndex = -1;
                let previousTotalFitness = -1;
                for (const row of simulationResults) {
                    const generationIndex = row['generation_index'];
                    const totalFitness = parseFloat(row['total_fitness']);
                    expect(generationIndex).toBeGreaterThanOrEqual(previousGenerationIndex);
                    if (generationIndex === previousGenerationIndex) {
                        expect(totalFitness).toBeGreaterThanOrEqual(previousTotalFitness);
                    }
                    previousGenerationIndex = generationIndex;
                    previousTotalFitness = totalFitness;
                }

                // Validate the simulation data for each candidate
                const candidate1Data = simulationResults.filter(r => r['generation_index'] === 0 && r['candidate_index'] === 0);
                expect(candidate1Data.length).toEqual(1);
                expect(candidate1Data).toEqual(expect.arrayContaining([
                    expect.objectContaining({ total_fitness: "123.45", simulation_method: 'OdTripSimulation', fitness_score: '100.00', candidate_data: { scenarioName: 'Scenario 0_0' }, data: candidateResult1.result.results.OdTripSimulation.results })
                ]));

                const candidate2Data = simulationResults.filter(r => r['generation_index'] === 0 && r['candidate_index'] === 1);
                expect(candidate2Data.length).toEqual(1);
                expect(candidate2Data).toEqual(expect.arrayContaining([
                    expect.objectContaining({ total_fitness: "54.32", simulation_method: 'OdTripSimulation', fitness_score: '89.00', candidate_data: { scenarioName: 'Scenario 0_1' }, data: candidateResult2.result.results.OdTripSimulation.results })
                ]));
                done();
            });
    });

    test('should stream the results detail by simulation method for a job without results', (done) => {
        const simulationResults: any[] = [];
        // Stream for joId2, there are no results yet
        const stream = dbQueries.streamSimulationResults(jobId2 as number);
        stream
            .on('error', (error) => {
                expect(error).toEqual('success');
                done();
            })
            .on('data', (row) => {
                simulationResults.push(row);
            })
            .on('end', () => {
                expect(simulationResults.length).toEqual(0);
                done();
            });
    });

    test('should stream the results detail by simulation method for a job that does not exist', (done) => {
        const simulationResults: any[] = [];
        // Stream for a job ID that does not exist
        const stream = dbQueries.streamSimulationResults(jobId2 as number + 1);
        stream
            .on('error', (error) => {
                expect(error).toEqual('success');
                done();
            })
            .on('data', (row) => {
                simulationResults.push(row);
            })
            .on('end', () => {
                expect(simulationResults.length).toEqual(0);
                done();
            });
    });
});

describe('Various complete tests', () => {

    // Delete all data before each test
    beforeEach(async () => {
        await dbQueries.truncate();
    })

    test('should delete for a single generation', async () => {
        // Add 3 records for generation 0 and 2 for generation 1
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 0,
            scenarioName: 'Scenario 0_0',
            resultData: candidateResult1
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 1,
            scenarioName: 'Scenario 0_1',
            resultData: candidateResult2
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 2,
            scenarioName: 'Scenario 0_2',
            resultData: candidateResult1
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 1,
            candidateIndex: 0,
            scenarioName: 'Scenario 1_0',
            resultData: candidateResult2
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 1,
            candidateIndex: 1,
            scenarioName: 'Scenario 1_1',
            resultData: candidateResult1
        });

        // Delete generation 1
        await dbQueries.deleteForJob(jobId as number, 1);

        // Count directly the records in the 3 tables
        const resultsTblCount = await knex(tableName).where('job_id', jobId as number).count<{ count: number }>('id as count').first();
        const simulationResultsTblCount = await knex(simulationMethodTableName).innerJoin(tableName, `${simulationMethodTableName}.candidate_id`, '=', `${tableName}.id`).where(`${tableName}.job_id`, jobId as number).count<{ count: number }>('candidate_id as count').first();
        const candidateLinesTblCount = await knex(candidateLinesTableName).innerJoin(tableName, `${candidateLinesTableName}.candidate_id`, '=', `${tableName}.id`).where(`${tableName}.job_id`, jobId as number).count<{ count: number }>('candidate_id as count').first();

        expect(resultsTblCount).toEqual({ count: "3" });
        expect(simulationResultsTblCount).toEqual({ count: "3" });
        expect(candidateLinesTblCount).toEqual({ count: "6" });
    });

    test('should delete for a complete job', async () => {
        // Add 3 records for generation 0 and 2 for generation 1
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 0,
            scenarioName: 'Scenario 0_0',
            resultData: candidateResult1
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 1,
            scenarioName: 'Scenario 0_1',
            resultData: candidateResult2
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 2,
            scenarioName: 'Scenario 0_2',
            resultData: candidateResult1
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 1,
            candidateIndex: 0,
            scenarioName: 'Scenario 1_0',
            resultData: candidateResult2
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 1,
            candidateIndex: 1,
            scenarioName: 'Scenario 1_1',
            resultData: candidateResult1
        });

        // Delete records for the complete job
        await dbQueries.deleteForJob(jobId as number);

        // Count directly the records in the 3 tables
        const resultsTblCount = await knex(tableName).where('job_id', jobId as number).count<{ count: number }>('id as count').first();
        const simulationResultsTblCount = await knex(simulationMethodTableName).innerJoin(tableName, `${simulationMethodTableName}.candidate_id`, '=', `${tableName}.id`).where(`${tableName}.job_id`, jobId as number).count<{ count: number }>('candidate_id as count').first();
        const candidateLinesTblCount = await knex(candidateLinesTableName).innerJoin(tableName, `${candidateLinesTableName}.candidate_id`, '=', `${tableName}.id`).where(`${tableName}.job_id`, jobId as number).count<{ count: number }>('candidate_id as count').first();

        expect(resultsTblCount).toEqual({ count: "0" });
        expect(simulationResultsTblCount).toEqual({ count: "0" });
        expect(candidateLinesTblCount).toEqual({ count: "0" });
    });

    test('should delete for a complete job', async () => {
        // Add 3 records for generation 0 of jobId and 2 for generation 0 of jobId2
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 0,
            scenarioName: 'Scenario 0_0',
            resultData: candidateResult1
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 1,
            scenarioName: 'Scenario 0_1',
            resultData: candidateResult2
        });
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 2,
            scenarioName: 'Scenario 0_2',
            resultData: candidateResult1
        });
        await dbQueries.create({
            jobId: jobId2 as number,
            generationIndex: 0,
            candidateIndex: 0,
            scenarioName: 'Scenario 0_0',
            resultData: candidateResult2
        });
        await dbQueries.create({
            jobId: jobId2 as number,
            generationIndex: 0,
            candidateIndex: 1,
            scenarioName: 'Scenario 0_1',
            resultData: candidateResult1
        });

        // Delete records for the complete jobId
        await dbQueries.deleteForJob(jobId as number);

        // Count directly the records in the 3 tables, there should be only for jobId 2
        const resultsTblCount = await knex(tableName).count<{ count: number }>('id as count').first();
        const simulationResultsTblCount = await knex(simulationMethodTableName).count<{ count: number }>('candidate_id as count').first();
        const candidateLinesTblCount = await knex(candidateLinesTableName).count<{ count: number }>('candidate_id as count').first();

        expect(resultsTblCount).toEqual({ count: "2" });
        expect(simulationResultsTblCount).toEqual({ count: "2" });
        expect(candidateLinesTblCount).toEqual({ count: "4" });
    });

    test('should not be possible to delete a line used by a candidate', async () => {
        // Add 1 record for generation 0
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 0,
            scenarioName: 'Scenario 0_0',
            resultData: candidateResult1
        });
        // Try to delete lineId1, should fail
        await expect(linesDbQueries.delete(lineId1)).rejects.toThrow(/violates foreign key constraint/);
    });

    test('should not be possible to delete a path used by a candidate', async () => {
        // Add 1 record for generation 0
        await dbQueries.create({
            jobId: jobId as number,
            generationIndex: 0,
            candidateIndex: 0,
            scenarioName: 'Scenario 0_0',
            resultData: candidateResult1
        });
        // Try to delete outbound and inbound paths, should fail
        await expect(pathDbQueries.delete(outboundPathLine1Id)).rejects.toThrow(/violates foreign key constraint/);
        await expect(pathDbQueries.delete(inboundPathLine1Id)).rejects.toThrow(/violates foreign key constraint/);
    });
})
