/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';
import inquirerFileTreeSelection from 'inquirer-file-tree-selection-prompt';

import { v4 as uuidV4 } from 'uuid';
import censusQueries from '../../models/db/census.db.queries';
import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';
import DataSource from 'chaire-lib-common/lib/services/dataSource/DataSource';
import { ZoneAttributes } from 'chaire-lib-common/lib/services/zones/Zone';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import dsQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import zonesQueries from 'chaire-lib-backend/lib/models/db/zones.db.queries';
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import xmlReader from 'xml-reader';
import fs from 'fs';

// The structure of the object given by the xml-reader package. Copied from the npm page.
interface XmlNode {
    /** element name (empty for text nodes) */
    name: string;
    /** node type (element or text), see NodeType constants */
    type: string;
    /** value of a text node */
    value: string;
    /** reference to parent node (null with parentNodes option disabled or root node) */
    parent: XmlNode;
    /** map of attributes name => value */
    attributes: { [name: string]: string };
    /** array of children nodes */
    children: XmlNode[];
}

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

/**
 * Task to import data about canada's dissemination blocks into the database.
 * This is intended to be used with data provided by statcan.
 *
 * task options are:
 * * --boundaries-file: Absolute path to the GML file defining the boundaries
 * * --proximity-file: Absolute path to the CSV file defining the proximity indices and population
 *
 * @export
 * @class ImportDisseminationBlocks
 * @implements {GenericTask}
 */
export class ImportDisseminationBlocks implements GenericTask {
    constructor() {
        inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
    }

    private async promptOverwriteDataSource(dataSourceName: string): Promise<boolean> {
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'overwrite',
                message: `${dataSourceName} already exists. Do you want to re-create the places in this data source?`,
                choices: [
                    { name: 'Yes', value: true },
                    { name: 'No', value: false }
                ]
            }
        ]);
        return answers.overwrite;
    }

    // This function is meant to work with the GML file found here: https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21
    private async importBoundaries(boundariesFile: string | undefined, dataSourceId: string): Promise<void> {
        let file = boundariesFile;
        if (file === undefined) {
            // Request the file from the user
            const answers = await inquirer.prompt([
                {
                    type: 'file-tree-selection',
                    name: 'zoneFilePath',
                    message: 'Please select the dissemination blocks boundaries file to import',
                    pageSize: 20
                }
            ]);
            file = answers.zoneFilePath;
        }

        if (typeof file !== 'string') {
            throw new Error('File is undefined');
        }

        if (!fileManager.fileExistsAbsolute(file)) {
            throw new Error(`The requested file ${file} does not exist`);
        }

        const parser = xmlReader.create({ stream: true, parentNodes: false });
        const readStream = fs.createReadStream(file);
        let i = 0;

        const batchSize = 1000;
        let batch: ZoneAttributes[] = [];
        let srIdArray: string[] = [];
        let geographyArray: string[] = [];

        console.log('Parsing through GML FILE:');

        parser.on('tag:gml:featureMember', (feature: XmlNode) => {
            try {
                const fme = feature.children[0];

                // The id of the dissemination block.
                const dbuid = (fme.children.find((element) => element.name === 'fme:DBUID') as XmlNode).children[0]
                    .value;

                const multiCoorList: string[] = [];

                // The id of the coordinate system used. Necessary to later convert into the coordinates used by Transition.
                let srId: string = '';

                // The GML file uses two types of geometry for the blocks: simple surfaces and multi surfaces, with slightly different structures that need their own parsing logic
                // Most of them are simple surfaces, with multi surfaces having multiple non connected polygons, such as a block that includes islands
                const surfaceProperty = fme.children.find((element) => element.name === 'gml:surfaceProperty');
                if (surfaceProperty !== undefined) {
                    const surface = surfaceProperty.children[0];
                    const srsName = surface.attributes.srsName;
                    srId = srsName.split('EPSG:')[1];
                    const polygonPatch = surface.children[0].children[0];
                    // Multiple children means a block has one or more hole in the middle, containing a smaller block.
                    for (const singlePolygon of polygonPatch.children) {
                        const ring = singlePolygon.children[0];
                        const ringType = ring.name;
                        // A few blocks are incorrectly written in the file, with nonsense geometry like single dots. The right blocks are all linear rings.
                        if (ringType === 'gml:LinearRing') {
                            const posList = ring.children[0].children[0].value;
                            multiCoorList.push(`((${this.addCommasToPosList(posList)}))`);
                        }
                    }
                }

                const multiSurfaceProperty = fme.children.find(
                    (element) => element.name === 'gml:multiSurfaceProperty'
                );
                if (multiSurfaceProperty !== undefined) {
                    const multiSurface = multiSurfaceProperty.children[0];
                    const srsName = multiSurface.attributes.srsName;
                    srId = srsName.split('EPSG:')[1];
                    const surfaceMembers = multiSurface.children;
                    for (const surfaceMember of surfaceMembers) {
                        const polygonPatch = surfaceMember.children[0].children[0].children[0];
                        for (const singlePolygon of polygonPatch.children) {
                            const ring = singlePolygon.children[0];
                            const ringType = ring.name;
                            if (ringType === 'gml:LinearRing') {
                                const posList = ring.children[0].children[0].value;
                                multiCoorList.push(`((${this.addCommasToPosList(posList)}))`);
                            }
                        }
                    }
                }

                if (multiCoorList.length >= 1) {
                    srIdArray.push(srId);
                    geographyArray.push(`MULTIPOLYGON(${multiCoorList.join()})`);
                    const zoneData = {
                        id: uuidV4(),
                        internal_id: dbuid,
                        dataSourceId,
                        geography: {
                            type: 'Polygon',
                            //We cannot add a zone with empty coordinates to the DB. Before adding the converted coordinates, we thus add a simple square polygon.
                            coordinates: [
                                [
                                    [0, 0],
                                    [0, 1],
                                    [1, 1],
                                    [1, 0],
                                    [0, 0]
                                ]
                            ]
                        } as GeoJSON.Polygon,
                        data: {}
                    };
                    batch.push(zoneData);
                }

                if (batch.length >= batchSize) {
                    readStream.pause();
                    zonesQueries.addZonesAndConvertedGeography(batch, srIdArray, geographyArray);
                    readStream.resume();
                    batch = [];
                    srIdArray = [];
                    geographyArray = [];
                }

                i++;
                if (i % 100 === 0) {
                    console.log(`Dissemination blocks parsed and added to DB: ${i}`);
                }
            } catch (error) {
                console.log(`Error while reading the gml file: ${error}`);
                readStream.destroy();
            }
        });

        parser.on('done', async () => {
            if (batch.length > 0) {
                readStream.pause();
                await zonesQueries.addZonesAndConvertedGeography(batch, srIdArray, geographyArray);
                readStream.resume();
            }
            console.log(`Finished! There are ${i} dissemination blocks.`);
        });

        return new Promise((resolve) => {
            readStream.on('data', (chunk) => {
                parser.parse(chunk.toString());
            });

            readStream.on('close', () => {
                resolve();
            });
        });
    }

    private addCommasToPosList(posList: string): string {
        const individualCoordinates = posList.split(' ');
        const result: string[] = [];

        for (let i = 0; i < individualCoordinates.length; i++) {
            let coor = individualCoordinates[i];

            // We want to add a comma after every second number to separate the coordinates (but not the last one)
            if (i < individualCoordinates.length - 1) {
                coor += i % 2 === 0 ? ' ' : ',';
            }

            result.push(coor);
        }

        return result.join('');
    }

    // This function is meant to work with the CSV file found here: https://www150.statcan.gc.ca/n1/pub/17-26-0002/172600022023001-eng.htm
    private async importIndexesAndPopulation(proximityFile: string | undefined): Promise<void> {
        let file = proximityFile;
        if (file === undefined) {
            // Request the file from the user
            const answers = await inquirer.prompt([
                {
                    type: 'file-tree-selection',
                    name: 'zoneFilePath',
                    message: 'Please select the proximity index file to import',
                    pageSize: 20
                }
            ]);
            file = answers.zoneFilePath;
        }

        if (typeof file !== 'string') {
            throw new Error('File is undefined');
        }

        if (!fileManager.fileExistsAbsolute(file)) {
            throw new Error(`The requested file ${file} does not exist`);
        }

        let lineCounter = 0;

        console.log('Parsing through CSV FILE:');

        const csvData: { id: string[]; population: number[]; indices: ProximityIndices[] }[] = [];

        let populationChunk: number[] = [];
        let indexChunk: ProximityIndices[] = [];
        let idChunk: string[] = [];

        const batchSize = 10000;

        await parseCsvFile(
            file,
            (line, rowNumber) => {
                lineCounter++;

                idChunk.push(line.DBUID);
                populationChunk.push(line.DBPOP);

                const indexRow = {
                    // The CSV file uses two periods to represent null indices.
                    prox_idx_emp: line.prox_idx_emp === '..' ? null : line.prox_idx_emp,
                    prox_idx_pharma: line.prox_idx_pharma === '..' ? null : line.prox_idx_pharma,
                    prox_idx_childcare: line.prox_idx_childcare === '..' ? null : line.prox_idx_childcare,
                    prox_idx_health: line.prox_idx_health === '..' ? null : line.prox_idx_health,
                    prox_idx_grocery: line.prox_idx_grocery === '..' ? null : line.prox_idx_grocery,
                    prox_idx_educpri: line.prox_idx_educpri === '..' ? null : line.prox_idx_educpri,
                    prox_idx_educsec: line.prox_idx_educsec === '..' ? null : line.prox_idx_educsec,
                    prox_idx_lib: line.prox_idx_lib === '..' ? null : line.prox_idx_lib,
                    prox_idx_parks: line.prox_idx_parks === '..' ? null : line.prox_idx_parks,
                    prox_idx_transit: line.prox_idx_transit === '..' ? null : line.prox_idx_transit
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

        csvData.push({ id: idChunk, population: populationChunk, indices: indexChunk });

        console.log(`There are ${lineCounter} dissemination blocks.`);
        console.log('Adding proximity indices and population data to database:');
        let dbCounter = 0;
        for (const batch of csvData) {
            console.log(`CSV data added to DB: ${dbCounter * batchSize}/${lineCounter}`);
            await zonesQueries.addJsonDataBatch(batch.id, batch.indices);
            await censusQueries.addPopulationBatch(batch.id, batch.population);
            dbCounter++;
        }
        console.log('Added proximity indices and population data!');
    }

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        // Handle arguments and default values
        const boundariesFile = argv['boundaries-file'] !== undefined ? (argv['boundaries-file'] as string) : undefined;
        const proximityFile = argv['proximity-file'] !== undefined ? (argv['proximity-file'] as string) : undefined;

        const dataSourceName = 'Dissemination block boundaries 2021';

        const currentDataSourceAttributes = await dsQueries.findByName(dataSourceName);
        const currentDataSource =
            currentDataSourceAttributes === undefined
                ? new DataSource({ name: dataSourceName, shortname: dataSourceName, type: 'zones' }, true)
                : new DataSource(currentDataSourceAttributes, false);

        if (currentDataSourceAttributes === undefined || (await this.promptOverwriteDataSource(dataSourceName))) {
            const dataSourceId = currentDataSource.getId();

            // Create data source in the database or reset its data
            if (currentDataSourceAttributes === undefined) {
                console.log('Creating data source...');
                await dsQueries.create(currentDataSource.attributes);
                console.log('Data source created.');
            } else {
                console.log('Resetting data source...');
                await zonesQueries.deleteForDataSourceId(dataSourceId);
                console.log('Data source reset.');
            }

            await this.importBoundaries(boundariesFile, dataSourceId);
            await this.importIndexesAndPopulation(proximityFile);
        } else {
            console.log(`Not re-creating places in existing data source '${dataSourceName}'.`);
        }
    }
}
