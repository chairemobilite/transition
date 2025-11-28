/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import random from 'random';

import Candidate, { Result, ResultSerialization } from './Candidate';
import Line from 'transition-common/lib/services/line/Line';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import * as AlgoTypes from '../internalTypes';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { randomFromDistribution } from 'chaire-lib-common/lib/utils/RandomUtils';
import { getLineWeight } from 'transition-common/lib/services/line/LineUtils';
import { EvolutionaryTransitNetworkDesignJob, EvolutionaryTransitNetworkDesignJobType } from '../../networkDesign/transitNetworkDesign/evolutionary/types';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import { SimulationMethodType } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { SIMULATION_METHODS_FACTORY } from '../../simulation/methods/SimulationMethod';

// Proportion between the number of vehicles used and the available number under which this candidate is considered invalid
const USED_VEHICLES_THRESHOLD = 0.75;

class LineAndNumberOfVehiclesNetworkCandidate extends Candidate {
    private scenario: Scenario | undefined;

    constructor(
        chromosome: AlgoTypes.CandidateChromosome,
        wrappedJob: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>
    ) {
        super(chromosome, wrappedJob);
    }

    private prepareNetwork(): Line[] {
        const lines = this.wrappedJob.simulatedLineCollection.getFeatures();
        const candidateLines: Line[] = [];
        this.chromosome.lines.forEach((lineIsActive, lineIndex) => {
            if (lineIsActive) {
                candidateLines.push(lines[lineIndex]);
            }
        });
        return candidateLines;
    }

    private assignNumberOfVehicles(candidateLines: Line[], nbVehicles: number): string[] {
        // For each candidateLine, start by assigning the minimum number of vehicles
        const currentLvlIndexes = candidateLines.map((_line) => 0);

        let usedVehicles = candidateLines
            .map((line) => this.wrappedJob.lineServices[line.getId()][0].numberOfVehicles)
            .reduce((cntVeh, sum) => sum + cntVeh, 0);
        if (usedVehicles > nbVehicles) {
            throw new TrError(`Impossible to assign minimal level of service for this combination. Woud require ${usedVehicles} vehicles`, 'GALNCND001');
        }

        // Add line weights to have more probability of increased service for largest lines
        const lineWeights = candidateLines
            .map((line) => getLineWeight(line))
            .map((weight) => (weight === null ? 1 : weight));
        const totalWeight = lineWeights.reduce((weight, current) => weight + current, 0);
        let failedAttempts = 0;
        const maxFailedAttemps = candidateLines.length * 2;
        while (usedVehicles < nbVehicles && failedAttempts < maxFailedAttemps) {
            // Try increasing the level of service for a random line
            const increaseLevelForLineIdx = randomFromDistribution(
                lineWeights,
                random.float(0.0, 1.0),
                totalWeight
            );
            const nextLevel = currentLvlIndexes[increaseLevelForLineIdx] + 1;
            const nextLineLevel = this.wrappedJob.lineServices[candidateLines[increaseLevelForLineIdx].getId()][nextLevel];
            if (nextLineLevel === undefined) {
                failedAttempts++;
                continue;
            }
            const addedVehicles =
                nextLineLevel.numberOfVehicles -
                this.wrappedJob.lineServices[candidateLines[increaseLevelForLineIdx].getId()][nextLevel - 1]
                    .numberOfVehicles;
            if (usedVehicles + addedVehicles > nbVehicles) {
                failedAttempts++;
                continue;
            }
            usedVehicles += addedVehicles;
            currentLvlIndexes[increaseLevelForLineIdx]++;
        }

        if (usedVehicles / nbVehicles < USED_VEHICLES_THRESHOLD) {
            console.warn(`Too few vehicles (${usedVehicles}) were assigned for this combination, but still using`);
            //throw new TrError(`Too few vehicles (${usedVehicles}) were assigned for this combination`, 'GALNCND004');
        }

        return currentLvlIndexes.map((currentLvlIndex, index) =>
            this.wrappedJob.lineServices[candidateLines[index].getId()][currentLvlIndex].service.getId()
        );
    }

    private assignServices(candidateLines: Line[], attempt = 0): string[] {
        try {
            if (this.wrappedJob.parameters.transitNetworkDesignParameters.nbOfVehicles !== undefined) {
                return this.assignNumberOfVehicles(
                    candidateLines,
                    this.wrappedJob.parameters.transitNetworkDesignParameters.nbOfVehicles
                );
            }
        } catch (error) {
            if (attempt > 3) {
                console.log(`Done retrying service assignment after error: ${error}`);
                throw new TrError(
                    'After 3 attempts, it was not possible to assign levels of services to this line combination',
                    'GALNCND002'
                );
            }
            if (TrError.isTrError(error)) {
                if (error.getCode() === 'GALNCND001') {
                    throw error;
                }
                console.log(`Retrying service assignment after error: ${error.message}`);
                return this.assignServices(candidateLines, attempt + 1);
            }
            throw error; 
        }
        throw 'Not implemented yet, should assign random level of services';
    }

    //TODO: Add functionality to the _socket argument, or remove it.
    async prepareScenario(_socket: EventEmitter): Promise<Scenario> {

        const lines = this.prepareNetwork();
        const services = this.assignServices(lines);
        services.push(...(this.wrappedJob.parameters.transitNetworkDesignParameters.nonSimulatedServices || []));
        const maxNumberOfVehicles = this.wrappedJob.parameters.transitNetworkDesignParameters.nbOfVehicles;
        const scenario = new Scenario(
            {
                name: `GALND_${this.wrappedJob.job.id}_${maxNumberOfVehicles}veh${lines.length}lines_${this.chromosome.name}`,
                services,
                data: { forJob: this.wrappedJob.job.id }
            },
            true
        );
        this.scenario = scenario;

        // TODO Update schedules for a random departure time in a range

        return this.scenario;
    }

    getScenario(): Scenario | undefined {
        return this.scenario;
    }

    // FIXME Was in SimulationRun before, it does not belong to a specific Candidate of a specific algorithm
    private simulateScenario = async (
        scenario: Scenario
    ): Promise<{ results: { [methodType: string]: { fitness: number; results: unknown } } }> => {
        
        const simulationMethodType = this.wrappedJob.parameters.simulationMethod.type;
        const methodOptions = this.wrappedJob.parameters.simulationMethod.config;
        const allResults: { [methodType: string]: { fitness: number; results: unknown } } = {};

        const factory = SIMULATION_METHODS_FACTORY[simulationMethodType];
        if (factory === undefined) {
            throw new TrError(`Unknown simulation method: ${simulationMethodType}`, 'SIOMSCEN004');
        }
        try {
            // FIXME Type properly when the methods are typed better (see issues #1533, #1560 and #1553)
            const simulationMethod = factory.create(methodOptions as any, this.wrappedJob);
            const results = await simulationMethod.simulate(scenario.getId());
            allResults[simulationMethodType] = results;
        
            // TODO This return value used to return a totalFitness field, but different methods have different result fitness ranges, we need to figure out how to put them together
            return {
                results: allResults
            };
        } catch (error) {
            throw error;
        }
    }

    async simulate(): Promise<Result> {
        console.log('start simulating candidate');
        const scenario = this.scenario;
        if (scenario === undefined) {
            throw new TrError('Undefined scenario!', 'GALNCND003');
        }
        const result = {
            /** total fitness is still undefined */
            totalFitness: Number.NaN,
            results: (await this.simulateScenario(scenario)).results
        };
        this.result = result;
        console.log('done simulating candidate');
        return result;
    }

    toString(showChromosome = false) {
        // showChromosome = true will show activated lines shortnames
        const serializedResults = this.serialize();
        const allLines = this.wrappedJob.simulatedLineCollection.getFeatures();
        return `candidate_${serializedResults.numberOfVehicles}veh${
            serializedResults.numberOfLines
        }lines_scenario_${this.scenario?.getId()}${
            showChromosome
                ? '_[' +
                  JSON.stringify(
                      this.chromosome.lines
                          .filter((line) => line === true)
                          .map((line, i) => allLines[i].attributes.shortname)
                          .join('|')
                  ) +
                  ']'
                : ''
        }`;
    }

    serialize(): ResultSerialization {
        const result = this.getResult();
        const serviceIds = (this.getScenario() as Scenario).attributes.services;
        const allLines = this.wrappedJob.simulatedLineCollection.getFeatures();
        const details = {
            lines: {},
            numberOfLines: 0,
            numberOfVehicles: 0,
            maxNumberOfVehicles: this.wrappedJob.parameters.transitNetworkDesignParameters.nbOfVehicles,
            result
        };
        let totalNumberOfVehicles = 0;
        let numberOfLines = 0;
        for (let i = 0; i < this.chromosome.lines.length; i++) {
            if (this.chromosome.lines[i] !== true) {
                continue;
            }
            numberOfLines++;
            const line = allLines[i];
            const lineServices = serviceIds
                .map((serviceId) => line.attributes.scheduleByServiceId[serviceId])
                .filter((schedule) => schedule !== undefined);
            if (lineServices.length > 1) {
                console.log(
                    `More than one service for line ${line.attributes.shortname} in candidate scenario: This is not supposed to happen`
                );
            }
            if (lineServices.length === 0) {
                throw new TrError(
                    `Line ${line.attributes.shortname} is supposed to be active in scenario, but there is no service for it`,
                    'GALNCND005'
                );
            }

            const lineLvlOfService = this.wrappedJob.lineServices[line.getId()].find(
                (lineLvlOfService) => lineLvlOfService.service.getId() === lineServices[0].service_id
            );

            totalNumberOfVehicles +=
                lineLvlOfService && !isNaN(lineLvlOfService.numberOfVehicles) ? lineLvlOfService.numberOfVehicles : 0;
            details.lines[line.getId()] = {
                shortname: line.attributes.shortname,
                nbVehicles: lineLvlOfService?.numberOfVehicles
            };
        }
        details.numberOfVehicles = totalNumberOfVehicles;
        details.numberOfLines = numberOfLines;
        return details;
    }
}

export default LineAndNumberOfVehiclesNetworkCandidate;
