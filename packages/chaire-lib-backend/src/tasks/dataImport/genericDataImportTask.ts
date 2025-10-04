/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { readdirSync } from 'fs';
import { select, input, confirm } from '@inquirer/prompts';

import { GenericTask } from '../genericTask';
import { GeojsonOutputter } from './osmImportUtils';

/**
 * Generic data import task, that takes care or asking for the data source ID
 * and makes sure the import directory for this data source exists.
 *
 * @todo Eventually refactor the task classes so interactive questions can be
 * asked either through the inquirer or through a web form
 *
 * TODO Do not hardcode directories this way, it should be possible to stub more
 * easily.
 */
export default abstract class GenericDataImportTask implements GenericTask {
    protected static readonly POLYGON_FILE = 'polygon.geojson';
    protected static readonly OSM_RAW_DATA_FILE = 'osmRawData.json';
    protected static readonly OSM_GEOJSON_FILE = 'osmData.geojson';
    protected static readonly POLYGON_ENHANCED_GEOJSON_FILE = 'osmPolygonsEnhanced.geojson';
    protected static readonly RESIDENTIAL_ENTRANCES_FILE = 'residentialEntrances.geojson';
    protected static readonly ALL_RESIDENCES_FILE = 'allFlatsEntrances.geojson';
    protected static readonly RESIDENTIAL_ZONES_FILE = 'residentialZones.geojson';
    protected static readonly POINT_OF_INTEREST_FILE = 'pointOfInterestLocations.geojson';
    protected static readonly CUSTOM_POINT_OF_INTEREST_FILE = 'customPointOfInterestLocations.geojson';
    protected static readonly WEIGHTED_POINT_OF_INTEREST_FILE = 'pointOfInterestLocationsWeighted.geojson';
    protected static readonly ID_SEPARATOR = '-';
    protected static readonly NEW_DATA_SOURCE_ID = '__newDataSource__';

    protected fileManager: any;
    protected _importDir: string;
    protected dataSourceDirectory: string;
    protected _geojsonOutputter: GeojsonOutputter = new GeojsonOutputter();

    constructor(fileManager: any) {
        this.fileManager = fileManager;
        this._importDir = fileManager.directoryManager.projectDirectory + '/imports/';
        this.dataSourceDirectory = this._importDir;
    }

    private getDirectories = () =>
        readdirSync(this._importDir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

    protected getDataSourceDirectory = (shortname: string) =>
        this.getDirectories().find((dirName) => dirName.startsWith(shortname));

    private ensureDirectoryExists = (dataSourceId: string) => {
        if (!this.getDataSourceDirectory(dataSourceId)) {
            this.fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(this._importDir + dataSourceId);
        }
    };

    private getDataSourceInteractive = async (): Promise<string> => {
        const directories = this.getDirectories();

        // Get the data source IDs and names from the directory names
        const dataSourcesChoices: { name: string; value: string }[] = directories.map((dirName) => {
            const index = dirName.indexOf(GenericDataImportTask.ID_SEPARATOR);
            return {
                name: index > 0 ? dirName.substring(index + 1) : dirName,
                value: index > 0 ? dirName.substring(0, index) : dirName
            };
        });

        const validate = (value: string) => {
            if (dataSourcesChoices.some((ds) => ds.value === value)) {
                return 'Data Source ID already exists';
            }
            if (value.includes(GenericDataImportTask.ID_SEPARATOR)) {
                return 'Character \'' + GenericDataImportTask.ID_SEPARATOR + '\' is not allowed in shortname';
            }
            return true;
        };

        dataSourcesChoices.push({
            name: '--New data source--',
            value: GenericDataImportTask.NEW_DATA_SOURCE_ID
        });

        const dataSourceId = await select({
            message: 'Please select a data source for import',
            choices: dataSourcesChoices
        });

        if (dataSourceId === GenericDataImportTask.NEW_DATA_SOURCE_ID) {
            const newDataSourceShortname = await input({
                message: 'New data source shortname',
                validate
            });
            const newDataSourceName = await input({
                message: 'New data source name'
            });

            this.fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(
                this._importDir + newDataSourceShortname + GenericDataImportTask.ID_SEPARATOR + newDataSourceName
            );

            return newDataSourceShortname;
        }

        return dataSourceId;
    };

    protected getDataSourceIdDirectory = async (dataSourceId: unknown): Promise<string> => {
        // Get the data source ID from the parameter or ask the user
        let dsId: string | undefined;
        if (dataSourceId) {
            dsId = typeof dataSourceId === 'string' ? (dataSourceId as string) : undefined;
            if (!dsId) {
                throw new Error('Invalid data source ID, cannot complete task');
            }
        } else {
            dsId = await this.getDataSourceInteractive();
        }
        this.ensureDirectoryExists(dsId);
        const directory = this.getDataSourceDirectory(dsId);
        if (!directory) {
            throw new Error('Directory for data source does not exist');
        }
        this.dataSourceDirectory = directory;
        return directory;
    };

    protected async promptOverwriteIfExists(absoluteFilePath: string, message = 'File'): Promise<boolean> {
        if (!this.fileManager.fileExistsAbsolute(absoluteFilePath)) {
            return true;
        }
        const overwrite = await confirm({
            message: `${message} already exists. Overwrite?`,
            default: false
        });
        return overwrite;
    }

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        const dataSourceId = argv.dataSourceId;
        const directory = await this.getDataSourceIdDirectory(dataSourceId);
        const idEditorUrl = argv.idEditorUrl;
        if (typeof idEditorUrl === 'string') {
            this._geojsonOutputter = new GeojsonOutputter(idEditorUrl);
        }
        return this.doRun(directory);
    }

    protected abstract doRun(dataSourceDirectory: string): Promise<void>;
}
