/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import JSONStream from 'JSONStream';
import { v4 as uuidv4 } from 'uuid';
import inquirer from 'inquirer';

import placesDbQueries from '../../models/db/places.db.queries';
import dataSourcesDbQuery from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import { PlaceAttributes } from 'transition-common/lib/services/places/Place';
import DataSource from 'chaire-lib-common/lib/services/dataSource/DataSource';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import PQueue from 'p-queue';

const pipelineAsync = promisify(pipeline);

// FIXME This prompt works only on command line where the user can answer. Need
// to support arbitrary prompts, like going through a web interface.
async function promptOverwriteDataSource(dataSourceName): Promise<boolean> {
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

/**
 * Import the points from the geojson file into the database, in the data source
 * with the given name. If the data source already exists, the user will be
 * prompted to confirm overwriting the existing data.
 *
 * The GeoJSON file should contain a FeatureCollection with Point features. If
 * the feature contains a `name` or `description` property, it will be used for
 * the place's name or description, respectively. All other properties will be
 * stored in the `data` field of the place.
 *
 * FIXME Consider separating the data source creation/reset from the import, so
 * that this function just imports the data and does not require interactive
 * answer from the user.
 *
 * @param geojsonFilePath The absolute path to the GeoJSON file to import
 * @param dataSourceName The data source name
 */
export default async function importGeojsonPlaces(geojsonFilePath: string, dataSourceName: string): Promise<void> {
    if (!fileManager.fileExistsAbsolute(geojsonFilePath)) {
        throw new Error(`GeoJSON file not found: ${geojsonFilePath}`);
    }

    const currentDataSourceAttributes = await dataSourcesDbQuery.findByName(dataSourceName);
    const currentDataSource =
        currentDataSourceAttributes === undefined
            ? new DataSource({ name: dataSourceName, shortname: dataSourceName, type: 'places' }, true)
            : new DataSource(currentDataSourceAttributes, false);

    if (currentDataSourceAttributes === undefined || (await promptOverwriteDataSource(dataSourceName))) {
        const dataSourceId = currentDataSource.getId();

        // Create data source in the database or reset its data
        if (currentDataSourceAttributes === undefined) {
            await dataSourcesDbQuery.create(currentDataSource.getAttributes());
        } else {
            await placesDbQueries.deleteForDataSourceId(dataSourceId);
        }

        const readStream = fs.createReadStream(geojsonFilePath);
        const jsonStream = JSONStream.parse('features.*');
        let placeCount = 0;

        await pipelineAsync(readStream, jsonStream, async (featureStream) => {
            // Use a pqueue to avoid overwhelming the database with too many
            // concurrent inserts. Without this, even with bulk inserts, there
            // were stream errors.
            const queue = new PQueue({ concurrency: 10 });

            const promiseProducer = async (feature: GeoJSON.Feature) => {
                if (feature.geometry.type !== 'Point') {
                    console.log(`Skipping non-point feature: ${feature.properties?.name} ${feature.id}`);
                    return;
                }
                const place: PlaceAttributes = {
                    id: uuidv4(),
                    data_source_id: dataSourceId,
                    geography: feature.geometry,
                    name: feature.properties?.name,
                    description: feature.properties?.description,
                    data: {
                        ...feature.properties
                    }
                };
                // FIXME Might be worth saving a few places and then doing a bulk insert
                await placesDbQueries.create(place);
                placeCount++;
            };

            for await (const feature of featureStream) {
                queue.add(async () => promiseProducer(feature));
            }

            await queue.onIdle(); // Wait for all queue tasks to complete
        });

        console.log(`Imported ${placeCount} places from ${geojsonFilePath} into data source '${dataSourceName}'`);
    } else {
        console.log(`Not importing existing places data source '${dataSourceName}'`);
    }
}
