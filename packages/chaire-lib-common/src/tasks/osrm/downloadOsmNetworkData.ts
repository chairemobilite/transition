/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';

import osmDownloader from '../../utils/osm/OsmOverpassDownloader';
import { GenericTask } from '../genericTask';
import { PromptGeojsonPolygonService } from '../../services/prompt/promptGeojsonService';
import networksPolyForOsrm from '../../config/osm/overpassQueries/networksPolyForOsrm';

/**
 * Task to download network data from OpenStreetMap for a polygon region.
 *
 * task options are:
 *
 * * --[no-]interactive: Whether to prompt the user for polygon file name or to
 *   overwrite the OSM data file
 * * --polygon-file: Absolute path to the file containing the geojson polygon
 * * --osm-file: Absolute path to the file where to save the OpenStreetMap raw
 *   data
 *
 * @export
 * @class DownloadOsmNetworkData
 * @implements {GenericTask}
 */
export class DownloadOsmNetworkData implements GenericTask {
    private _promptPolygon: PromptGeojsonPolygonService;
    private _fileManager: any;

    // TODO Use dependency injection to pass the prompter
    // TODO Remove file manager from parameters
    constructor(fileManager: any, promptPolygon: PromptGeojsonPolygonService) {
        this._fileManager = fileManager;
        this._promptPolygon = promptPolygon;
    }

    protected async promptOverwriteIfExists(
        absoluteFilePath: string,
        message = 'File',
        interactive = true
    ): Promise<boolean> {
        if (!this._fileManager.fileExistsAbsolute(absoluteFilePath) || !interactive) {
            return true;
        }
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'overwrite',
                message: `${message} already exists. Overwrite?`,
                choices: [
                    { name: 'Yes', value: true },
                    { name: 'No', value: false }
                ]
            }
        ]);
        return answers.overwrite;
    }

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        // Handle arguments and default values
        const filePath = argv['polygon-file'];
        const osmRawFile = argv['osm-file'];
        const defaultInteractive = argv['interactive'] !== undefined ? (argv['interactive'] as boolean) : true;
        const retry = argv['retry'] !== undefined ? parseInt(argv['retry'] as string) : 0;
        // Make sure the number of retries is between 0 and 6
        const retryAttempts = isNaN(retry) ? 0 : Math.min(Math.max(retry, 0), 6);
        const importDir = this._fileManager.directoryManager.projectDirectory + '/imports/';
        const polygonFile = filePath ? (filePath as string) : importDir + 'polygon.geojson';
        const osmRawDataFile = osmRawFile ? (osmRawFile as string) : importDir + 'osm_network_data.osm';

        // Check that the import directory is present. It's automatically created by the main transition app normally
        if (!this._fileManager.fileExistsAbsolute(importDir)) {
            console.log('Import directory does not exist, please create ', importDir);
            return;
        }

        // Run the task
        const polygonGeojson = await this._promptPolygon.getPolygon(polygonFile, {
            interactive: filePath !== undefined ? false : defaultInteractive
        });

        if (await this.promptOverwriteIfExists(osmRawDataFile, 'OpenStreeMap network data file', defaultInteractive)) {
            // TODO: There's probably a better way to write this loop
            const promise = new Promise<void>((resolve, reject) => {
                let nbRetry = 0;
                const downloadData = async () => {
                    try {
                        await osmDownloader.fetchAndWriteXml(osmRawDataFile, polygonGeojson, networksPolyForOsrm);
                        resolve();
                    } catch (error) {
                        nbRetry++;
                        // Too many connections, retry
                        if ((error as any).status === 429) {
                            console.log('Too many requests to API');
                            if (nbRetry <= retryAttempts) {
                                // Random delay in seconds to wait, between 1 and 5 minutes, adding an exponential supplementary delay for each retry
                                const exponentialBackoff = Math.pow(4, nbRetry - 1);
                                const delaySeconds =
                                    60 +
                                    exponentialBackoff +
                                    Math.floor(Math.random() * (240 + 2 * exponentialBackoff));
                                console.log(
                                    'Retry attempt ' +
                                        nbRetry +
                                        '. Waiting an arbitrary delay in seconds before attempting to download again...',
                                    delaySeconds
                                );
                                setTimeout(downloadData, delaySeconds * 1000);
                            } else {
                                reject('Too many requests');
                            }
                        } else {
                            console.error('Error download from API', error);
                            reject(error);
                        }
                    }
                };
                downloadData();
            });
            await promise;
        }
    }
}
