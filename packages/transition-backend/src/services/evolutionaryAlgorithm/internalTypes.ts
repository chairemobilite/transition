/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Random } from 'random';

import Agency from 'transition-common/lib/services/agency/Agency';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import Service from 'transition-common/lib/services/service/Service';
import SimulationRun from '../simulation/SimulationRun';
import { EvolutionaryAlgorithmOptions } from 'transition-common/lib/services/simulation/algorithm/EvolutionaryAlgorithm';

export type LineLevelOfService = {
    numberOfVehicles: number;
    service: Service;
};

/** Maps line ids with an object where the key is the number of vehicle and the
 * value is the service */
export type LineServices = {
    [key: string]: LineLevelOfService[];
};

export type BriefGenerationResult = {
    type: 'brief';
};

export type DetailedGenerationResult = {
    type: 'detailed';
};

export type GenerationResult = BriefGenerationResult | DetailedGenerationResult;

export type SimulationResult = {
    generations: GenerationResult[][];
};

export interface RuntimeAlgorithmData {
    /**
     * The agencies to simulate
     */
    agencies: Agency[];
    randomGenerator: Random;
    simulationRun: SimulationRun;
    /**
     * The collection of lines to simulate. The lines to keep are at the
     * beginning of the features array, the rest are in an arbitrary order
     */
    lineCollection: LineCollection;
    linesToKeep: string[];
    /**
     * Contain the services for simulated lines, as well as those to keep
     */
    services: ServiceCollection;
    lineServices: LineServices;
    /**
     * IDs of services that are not to be simulated
     */
    nonSimulatedServices: string[];
    populationSize: number;
    options: EvolutionaryAlgorithmOptions;
}

export interface CandidateChromosome {
    lines: boolean[];
    name: string;
}
