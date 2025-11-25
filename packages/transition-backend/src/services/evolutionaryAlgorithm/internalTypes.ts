/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Service from 'transition-common/lib/services/service/Service';

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

export interface CandidateChromosome {
    lines: boolean[];
    name: string;
}
