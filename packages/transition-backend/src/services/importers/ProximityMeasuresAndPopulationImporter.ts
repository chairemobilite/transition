/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import censusQueries from '../../models/db/census.db.queries';
import zonesQueries from 'chaire-lib-backend/lib/models/db/zones.db.queries';
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

// A structure to hold Statcan's proximity data. See https://www150.statcan.gc.ca/n1/pub/17-26-0002/172600022023001-eng.htm for more info.
interface ProximityIndices {
    /** Normalised value of a dissemination block's proximity to employment. */
    prox_idx_emp: number | null;
    /** Normalised value of a dissemination block's proximity to pharmacy and drug stores. */
    prox_idx_pharma: number | null;
    /** Normalised value of a dissemination block's proximity to child care facilities. */
    prox_idx_childcare: number | null;
    /** Normalised value of a dissemination block's proximity to health facilities. */
    prox_idx_health: number | null;
    /** Normalised value of a dissemination block's proximity to grocery stores. */
    prox_idx_grocery: number | null;
    /** Normalised value of a dissemination block's proximity to primary education facilities. */
    prox_idx_educpri: number | null;
    /** Normalised value of a dissemination block's proximity to secondary education facilities. */
    prox_idx_educsec: number | null;
    /** Normalised value of a dissemination block's proximity to libraries. */
    prox_idx_lib: number | null;
    /** Normalised value of a dissemination block's proximity to parks. */
    prox_idx_parks: number | null;
    /** Normalised value of a dissemination block's proximity to transit trips. */
    prox_idx_transit: number | null;
}

export default async function importProximityMeasuresAndPopulationFromCsv(proximityFile: string): Promise<void> {
    if (!fileManager.fileExistsAbsolute(proximityFile)) {
        throw new Error(`Proximity CSV file not found: ${proximityFile}`);
    }

    let lineCounter = 0;

    console.log('Parsing through CSV FILE:');

    const csvData: { id: string[]; population: number[]; indices: ProximityIndices[] }[] = [];

    let populationChunk: number[] = [];
    let indexChunk: ProximityIndices[] = [];
    let idChunk: string[] = [];

    const batchSize = 10000;

    await parseCsvFile(
        proximityFile,
        (line, rowNumber) => {
            lineCounter++;

            idChunk.push(line.DBUID);
            populationChunk.push(Number(line.DBPOP));

            const indexRow = {
                // The CSV file uses two periods to represent null indices.
                prox_idx_emp: line.prox_idx_emp === '..' ? null : Number(line.prox_idx_emp),
                prox_idx_pharma: line.prox_idx_pharma === '..' ? null : Number(line.prox_idx_pharma),
                prox_idx_childcare: line.prox_idx_childcare === '..' ? null : Number(line.prox_idx_childcare),
                prox_idx_health: line.prox_idx_health === '..' ? null : Number(line.prox_idx_health),
                prox_idx_grocery: line.prox_idx_grocery === '..' ? null : Number(line.prox_idx_grocery),
                prox_idx_educpri: line.prox_idx_educpri === '..' ? null : Number(line.prox_idx_educpri),
                prox_idx_educsec: line.prox_idx_educsec === '..' ? null : Number(line.prox_idx_educsec),
                prox_idx_lib: line.prox_idx_lib === '..' ? null : Number(line.prox_idx_lib),
                prox_idx_parks: line.prox_idx_parks === '..' ? null : Number(line.prox_idx_parks),
                prox_idx_transit: line.prox_idx_transit === '..' ? null : Number(line.prox_idx_transit)
            };

            indexChunk.push(indexRow);
            if (lineCounter % 100 === 0) {
                console.log(`CSV rows parsed: ${rowNumber}`);
            }

            if (idChunk.length >= batchSize) {
                csvData.push({ id: idChunk, population: populationChunk, indices: indexChunk });
                idChunk = [];
                populationChunk = [];
                indexChunk = [];
            }
        },
        { header: true }
    );

    if (idChunk.length > 0) {
        csvData.push({ id: idChunk, population: populationChunk, indices: indexChunk });
    }

    console.log(`There are ${lineCounter} dissemination blocks.`);
    console.log('Adding proximity indices and population data to database:');
    let dbCounter = 0;
    for (const batch of csvData) {
        console.log(`CSV data added to DB: ${dbCounter * batchSize}/${lineCounter}`);

        const jsonBatch = batch.id.map((id, index) => {
            return { internalId: id, json: batch.indices[index] };
        });
        await zonesQueries.addJsonDataBatch(jsonBatch);

        const populationBatch = batch.id.map((id, index) => {
            return { internalId: id, population: batch.population[index] };
        });
        await censusQueries.addPopulationBatch(populationBatch);

        dbCounter++;
    }
    console.log('Added proximity indices and population data!');
}
