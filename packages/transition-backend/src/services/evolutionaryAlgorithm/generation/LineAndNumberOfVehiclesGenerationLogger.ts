/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenerationLogger from './GenerationLogger';
import Generation from './Generation';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

class LineAndNumberOfVehiclesGenerationLogger extends GenerationLogger {
    /*
    Get a simulation generation and log results to a file
    */
    doLog(generation: Generation): void {
        // FIXME Implement or drop? Was commented when changed SimulationRun for Job
        /*const generationNumber = generation.getGenerationNumber();
        const bestCandidate = generation.getCandidates()[0];
        // TODO, use keepCandidates simulation parameter to log the required number of best candidates.
        const bestCandidateAsString = bestCandidate.toString();
        const resultsDirectoryPath = generation.getSimulationRun().getResultsDirectoryPath(); // relative to project directory
        const csvFilePath = `${resultsDirectoryPath}/results.csv`; // relative to project directory
        const bestResults = bestCandidate.getResult().results;
        const serializedBestCandidate = bestCandidate.serialize();
        const methods = Object.keys(bestResults);

        const bestCandidateLinesWithNbVehiclesStrings: string[] = [];
        for (const lineId in serializedBestCandidate.lines) {
            bestCandidateLinesWithNbVehiclesStrings.push(
                `${serializedBestCandidate.lines[lineId].shortname}:${serializedBestCandidate.lines[lineId].nbVehicles}`
            );
        }

        if (this.formats.includes('csv')) {
            fileManager.directoryManager.createDirectoryIfNotExists(resultsDirectoryPath);
            if (generationNumber === 1) {
                // truncate and write csv header if first generation
                fileManager.writeFile(
                    csvFilePath,
                    `generation,bestCandidate,scenarioId,nbVehicles,nbLines,${methods
                        .map((method) => `${method}Fitness`)
                        .join(',')},lineDetails\n`,
                    { flag: 'w' }
                );
            }
            fileManager.writeFile(
                csvFilePath,
                `${generation.getGenerationNumber()},${bestCandidateAsString},${
                    bestCandidate.getScenario()?.getId() || ''
                },${serializedBestCandidate.numberOfVehicles},${serializedBestCandidate.numberOfLines},${methods
                    .map((method) => bestResults[method].fitness)
                    .join(',')},${bestCandidateLinesWithNbVehiclesStrings.join('|')}\n`,
                { flag: 'a' }
            );
        }
        if (this.formats.includes('log')) {
            console.log(`Best candidate of generation ${generationNumber}: ${bestCandidateAsString}`, {
                nbVehicles: serializedBestCandidate.numberOfVehicles,
                nbLines: serializedBestCandidate.numberOfLines,
                methods: methods,
                fitnesses: methods.map((method) => bestResults[method].fitness),
                lineDetails: bestCandidateLinesWithNbVehiclesStrings
            });
        } */
        // TODO: implement json logger
    }
}

export default LineAndNumberOfVehiclesGenerationLogger;
