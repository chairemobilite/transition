/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';
import inquirerFileTreeSelection from 'inquirer-file-tree-selection-prompt';

import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';
import { RoutingMode, routingModes } from 'chaire-lib-common/lib/config/routingModes';
import OSRMServicePreparation from '../../utils/processManagers/OSRMServicePreparation';

/**
 * Task to download network data from OpenStreetMap for a polygon region.
 *
 * task options are:
 *
 * * --[no-]interactive: Whether to prompt the user for the OSM data file
 * * --osm-file: Absolute path to the file where to save the OpenStreetMap raw
 *   data
 * * --mode: The modes to prepare. For multiple modes, one can enter --mode
 *   walking --mode cycling, etc
 * * --osrm-prefix: Specify a directory prefix
 *
 * @export
 * @class PrepareOsmNetworkData
 * @implements {GenericTask}
 */
export class PrepareOsmNetworkData implements GenericTask {
    private _fileManager: any;

    // TODO Remove file manager from parameters
    constructor(fileManager: any) {
        this._fileManager = fileManager;
        inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
    }

    private async getOsmFile(defaultFileName: string, importDir: string, interactive = true): Promise<string> {
        let fileName: string = defaultFileName;
        if (!this._fileManager.fileExistsAbsolute(fileName)) {
            if (!interactive) {
                throw new Error('File does not exist: ' + fileName);
            }
            inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
            // Ask the user for the file containing the geojson polygon
            const answers = await inquirer.prompt([
                {
                    type: 'file-tree-selection',
                    name: 'osmFilePath',
                    message: 'Please select the openstreetmap network data file (.osm or .osm.pbf)',
                    root: importDir,
                    pageSize: 20
                }
            ]);
            fileName = answers.osmFilePath;
        }
        return fileName;
    }

    protected async getModes(defaultModes: unknown, interactive: boolean): Promise<RoutingMode[]> {
        const modesArray =
            typeof defaultModes === 'string'
                ? [defaultModes as string]
                : Array.isArray(defaultModes)
                    ? (defaultModes as unknown[])
                    : [];
        const requestedModes = modesArray.filter((mode) => typeof mode === 'string').map((mode) => mode as string);
        const availableModes = requestedModes
            .filter((mode) => routingModes.includes(mode as RoutingMode))
            .map((mode) => mode as RoutingMode);
        const unavailableModes = requestedModes.filter((mode) => !routingModes.includes(mode as RoutingMode));
        // Warn if there is any mode that does not exist
        if (unavailableModes.length !== 0) {
            console.log(
                'Some requested modes are invalid: ' +
                    unavailableModes +
                    '. Possible values are ' +
                    routingModes +
                    '. You can request multiples modes by setting the --mode argument multiple time, for example --mode walking --mode cycling'
            );
        }
        if (availableModes.length === 0) {
            if (!interactive) {
                throw new Error(
                    'No mode set for osm data preparation. Enter modes with command line arguments --mode <mode1> [--mode <mode2>]'
                );
            }
            const answers = await inquirer.prompt([
                {
                    type: 'checkbox',
                    name: 'osrmPrepareModes',
                    choices: routingModes.map((mode) => {
                        return {
                            label: mode,
                            value: mode
                        };
                    }),
                    message: 'For which mode(s) do you want to prepare osrm data?'
                }
            ]);
            return answers.osrmPrepareModes;
        }
        return availableModes;
    }

    protected async getPrefix(defaultPrefix: unknown, interactive: boolean): Promise<string | null> {
        if (typeof defaultPrefix === 'string') {
            return defaultPrefix as string;
        }
        if (defaultPrefix && !interactive) {
            if (interactive) {
                console.log('Invalid default prefix ' + defaultPrefix + '. It should be a string');
            } else {
                throw new Error('Invalid default prefix ' + defaultPrefix + '. It should be a string');
            }
        }
        if (!interactive) {
            return null;
        }
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'directoryPrefix',
                message:
                    'Please choose a name for the OSRM (routing engine) directory prefix or keep empty for default',
                default: null
            }
        ]);
        return answers.directoryPrefix;
    }

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        // Handle arguments and default values
        const osmRawFile = argv['osm-file'];
        const defaultPrefix = argv['osrm-prefix'];
        const defaultModes = argv['mode'];
        const defaultInteractive = argv['interactive'] !== undefined ? (argv['interactive'] as boolean) : true;
        const importDir = this._fileManager.directoryManager.projectDirectory + '/imports/';
        // TODO This data should be common between the various osrm tasks
        const osmDefaultRawDataFile = osmRawFile ? (osmRawFile as string) : importDir + 'osm_network_data.osm';

        // Get answers for arguments if necessary
        const osmRawDataFile = await this.getOsmFile(
            osmDefaultRawDataFile,
            importDir,
            osmDefaultRawDataFile !== undefined ? false : defaultInteractive
        );
        const prefix = await this.getPrefix(defaultPrefix, defaultInteractive);
        const modes = await this.getModes(defaultModes, defaultInteractive);

        console.log('Data: ', osmRawDataFile, modes, prefix);

        console.log('preparing osrm directories...');

        for (let i = 0, countI = modes.length; i < countI; i++) {
            const mode = modes[i];

            console.log(`osrm data for mode ${mode} is being prepared.`);

            const result = await OSRMServicePreparation.prepare(osmRawDataFile, mode, prefix);
            if (result.status === 'prepared') {
                console.log(`osrm data for mode ${mode} is ready for routing.`);
            } else {
                console.log(`osrm data for mode ${mode} failed with error:`, result.error);
            }
        }
    }
}
