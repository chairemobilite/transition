/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Generation from './Generation';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

type LogFormats = 'csv' | 'log' | 'json';

class GenerationLogger {
    protected formats: ('csv' | 'log' | 'json')[];

    constructor(options: { formats: LogFormats[]; filePaths?: { [format: string /* LogFormats */]: string } }) {
        this.formats = options.formats;
    }

    /*
    Get a simulation generation and log results to a file
    */
    doLog(generation: Generation): void {
        // FIXME Implement or drop? Was commented when changed SimulationRun for Job
       /* const generationNumber = generation.getGenerationNumber();
        const bestCandidate = generation.getCandidates()[0];
        // TODO, use keepCandidates simulation parameter to log the required number of best candidates.
        const bestCandidateAsString = bestCandidate.toString();
        const resultsDirectoryPath = generation.getSimulationRun().getResultsDirectoryPath(); // relative to project directory
        const csvFilePath = `${resultsDirectoryPath}/results.csv`; // relative to project directory
        const bestResults = generation.getCandidates()[0].getResult().results;
        const methods = Object.keys(bestResults);

        if (this.formats.includes('csv')) {
            fileManager.directoryManager.createDirectoryIfNotExists(resultsDirectoryPath);
            if (generationNumber === 1) {
                // truncate and write csv header if first generation
                fileManager.writeFile(
                    csvFilePath,
                    `generation,bestCandidate,scenarioId,${methods.map((method) => `${method}Fitness`).join(',')}\n`,
                    { flag: 'w' }
                );
            }
            fileManager.writeFile(
                csvFilePath,
                `${generation.getGenerationNumber()},${bestCandidateAsString},${
                    bestCandidate.getScenario()?.getId() || ''
                },${methods.map((method) => bestResults[method].fitness).join(',')}\n`,
                { flag: 'a' }
            );
        }
        if (this.formats.includes('log')) {
            console.log(`Best candidate of generation ${generationNumber}: ${bestCandidateAsString}`, {
                methods: methods,
                fitnesses: methods.map((method) => bestResults[method].fitness)
            });
        } */
        // TODO: implement json logger
    }
}

export default GenerationLogger;
