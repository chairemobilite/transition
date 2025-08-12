/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';
import inquirerFileTreeSelection from 'inquirer-file-tree-selection-prompt';

import { v4 as uuidV4 } from 'uuid';
import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';
import DataSource from 'chaire-lib-common/lib/services/dataSource/DataSource';
import { ZoneAttributes } from 'chaire-lib-common/lib/services/zones/Zone';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import dsQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import zonesQueries from 'chaire-lib-backend/lib/models/db/zones.db.queries';
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import xmlReader from 'xml-reader';
import fs from 'fs';

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

/**
 * Task to import data about canada's dissemination blocks into the database.
 * This is intended to be used with data provided by statcan.
 *
 * task options are:
 * * --boundaries-file: Absolute path to the
 * * --proximity-file: Absolute path to the
 *
 * @export
 * @class ImportDisseminationBlocks
 * @implements {GenericTask}
 */
export class ImportDisseminationBlocks implements GenericTask {
    // TODO Remove file manager from parameters
    constructor() {
        inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
    }

    private async promptOverwriteDataSource(dataSourceName): Promise<boolean> {
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

        let i = 0;

        console.log('CSV FILE:');
        await parseCsvFile(
            file,
            (line, rowNumber) => {
                i++;
                //console.log(`${rowNumber}: ${line.DBUID}`);
            },
            { header: true }
        );

        console.log(`There are ${i} dissemination blocks.`);
    }

    private async importBoundaries(boundariesFile: string | undefined): Promise<void> {
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
                await dsQueries.create(currentDataSource.attributes);
            } else {
                await zonesQueries.deleteForDataSourceId(dataSourceId);
            }

            const parser = xmlReader.create({ stream: true, parentNodes: false });
            const readStream = fs.createReadStream(file);
            let i = 0;

            const batchSize = 1000;
            let batch: ZoneAttributes[] = [];
            let srIdArray: string[] = [];
            let geographyArray: string[] = [];

            parser.on('tag:gml:featureMember', (feature: XmlNode) => {
                try {
                    i++;
                    if (i % 100 === 0) {
                        console.log(`Iteration: ${i}`);
                    }
                    const fme = feature.children[0];
                    const dbuid = (fme.children.find((element) => element.name === 'fme:DBUID') as XmlNode).children[0]
                        .value;
                    const surfaceProperty = fme.children.find((element) => element.name === 'gml:surfaceProperty');
                    if (surfaceProperty !== undefined) {
                        const surface = surfaceProperty.children[0];
                        const srsName = surface.attributes.srsName;
                        const srId = srsName.split('EPSG:')[1];
                        const polygonPatch = surface.children[0].children[0];
                        const mutliCoorList: string[] = [];
                        for (const singlePolygon of polygonPatch.children) {
                            const ring = singlePolygon.children[0];
                            const ringType = ring.name;
                            if (ringType === 'gml:LinearRing') {
                                const posList = ring.children[0].children[0].value;
                                mutliCoorList.push(`((${this.addCommasToPosList(posList)}))`);
                            }
                        }

                        if (mutliCoorList.length >= 1) {
                            srIdArray.push(srId);
                            geographyArray.push(`MULTIPOLYGON(${mutliCoorList.join()})`);
                            const zoneData = {
                                id: uuidV4(),
                                internal_id: dbuid,
                                dataSourceId,
                                geography: {
                                    type: 'Polygon',
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
                    }

                    const multiSurfaceProperty = fme.children.find(
                        (element) => element.name === 'gml:multiSurfaceProperty'
                    );
                    if (multiSurfaceProperty !== undefined) {
                        const multiSurface = multiSurfaceProperty.children[0];
                        const srsName = multiSurface.attributes.srsName;
                        const srId = srsName.split('EPSG:')[1];
                        const surfaceMembers = multiSurface.children;
                        const mutliCoorList: string[] = [];
                        for (const surfaceMember of surfaceMembers) {
                            const polygonPatch = surfaceMember.children[0].children[0].children[0];
                            for (const singlePolygon of polygonPatch.children) {
                                const ring = singlePolygon.children[0];
                                const ringType = ring.name;
                                if (ringType === 'gml:LinearRing') {
                                    const posList = ring.children[0].children[0].value;
                                    mutliCoorList.push(`((${this.addCommasToPosList(posList)}))`);
                                }
                            }
                        }

                        if (mutliCoorList.length >= 1) {
                            srIdArray.push(srId);
                            geographyArray.push(`MULTIPOLYGON(${mutliCoorList.join()})`);
                            const zoneData = {
                                id: uuidV4(),
                                internal_id: dbuid,
                                dataSourceId,
                                geography: {
                                    type: 'Polygon',
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
                    }

                    if (batch.length >= batchSize) {
                        readStream.pause();
                        zonesQueries.addZonesAndConvertedGeography(batch, srIdArray, geographyArray);
                        readStream.resume();
                        batch = [];
                        srIdArray = [];
                        geographyArray = [];
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
                console.log(`There are ${i} dissemination blocks.`);
            });

            return new Promise((resolve) => {
                readStream.on('data', (chunk) => {
                    parser.parse(chunk.toString());
                });

                readStream.on('close', () => {
                    resolve();
                });
            });
        } else {
            console.log(`Not importing existing places data source '${dataSourceName}'`);
        }
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

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        // Handle arguments and default values
        const boundariesFile = argv['boundaries-file'] !== undefined ? (argv['boundaries-file'] as string) : undefined;
        //const proximityFile = argv['proximity-file'] !== undefined ? (argv['proximity-file'] as string) : undefined;

        await this.importBoundaries(boundariesFile);
        //await this.importIndexesAndPopulation(proximityFile);
    }
}
