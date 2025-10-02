/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';
import inquirerFileTreeSelection from 'inquirer-file-tree-selection-prompt';

import { GenericTask } from '../genericTask';
import { v4 as uuidV4 } from 'uuid';
import { fileManager } from '../../utils/filesystem/fileManager';
import dsQueries from '../../models/db/dataSources.db.queries';
import zonesQueries from '../../models/db/zones.db.queries';
import { DataSourceAttributes } from 'chaire-lib-common/lib/services/dataSource/DataSource';

/**
 * Task to import a zones data source in the database
 *
 * task options are:
 *
 * * --name: The name of the zones data source
 * * --shortname: The shortname of the data source
 * * --zones-file: Absolute path to the geojson file with the zones
 *
 * TODO
 * * Make sure data source with same shortname/name does not already exist
 * * Match both shortname and name for existing data sources
 * * Prompt to overwrite the zones for data source if there are already zones
 *   for the data source
 * * Add the --[no-]interactive parameter and never call inquirer if not
 *   interactive, to allow re-use of this from the application and not the CLI
 * * Add the zones shortname and name attributes to parameters to full
 *   non-interactive run
 *
 * @export
 * @class CreateUser
 * @implements {GenericTask}
 */
export class ImportZonesFromGeojson implements GenericTask {
    // TODO Remove file manager from parameters
    constructor() {
        inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
    }

    private getGeojsonData = async (
        filePath?: string
    ): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>> => {
        let file = filePath;
        if (file === undefined) {
            // Request the file from the user
            const answers = await inquirer.prompt([
                {
                    type: 'file-tree-selection',
                    name: 'zoneFilePath',
                    message: 'Please select the zones geojson file to import',
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

        const geojson = JSON.parse(fileManager.readFileAbsolute(file) as string);
        if (geojson.type === undefined) {
            throw new Error(`The file content is not geojson ${file}`);
        }

        if (geojson.type !== 'FeatureCollection') {
            throw new Error(`The file content is not a feature collection: ${file}`);
        }

        if (geojson.features.length === 0) {
            throw new Error(`The feature collection is empty: ${file}`);
        }

        geojson.features.forEach((feature: GeoJSON.Feature<GeoJSON.Geometry | null>, featureIdx) => {
            if (
                feature.geometry === null ||
                (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')
            ) {
                throw new Error(`Feature at index ${featureIdx} is not a Polygon or MultiPolygon`);
            }
        });
        return geojson;
    };

    private getDataSourceConfig = async (options: {
        dsName: string | undefined;
        dsShortname: string | undefined;
    }): Promise<string> => {
        const zonesDs = await dsQueries.collection({ type: 'zones' });

        let datasource: DataSourceAttributes | undefined = undefined;
        if (options.dsName !== undefined || options.dsShortname !== undefined) {
            const datasources = zonesDs.filter(
                (zoneDs) => zoneDs.name === options.dsName || zoneDs.shortname === options.dsShortname
            );
            if (datasources.length === 1) {
                datasource = datasources[0];
                await zonesQueries.deleteForDataSourceId(datasource.id);
            }
        }

        if (datasource === undefined && options.dsName !== undefined && options.dsShortname !== undefined) {
            // Create the new data source with the options
            const newDs = {
                shortname: options.dsShortname,
                name: options.dsName,
                type: 'zones' as const,
                data: {},
                id: uuidV4()
            };
            await dsQueries.create(newDs);
            datasource = await dsQueries.read(newDs.id);
        } else if (datasource === undefined) {
            // Request the user for the datasource
            //choose data source shortname and name:
            const dataSourcesChoices = zonesDs.map((dataSource) => ({
                name: `${dataSource.name} - ${dataSource.shortname}`,
                value: dataSource.id
            }));
            dataSourcesChoices.push({
                name: '--New data source--',
                value: '__newDataSource__'
            });

            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'dataSourceId',
                    message: 'Please select a data source (zones will be replaced) or create a new one for the zones',
                    choices: dataSourcesChoices
                },
                {
                    when: function (answers) {
                        return answers.dataSourceId === '__newDataSource__';
                    },
                    type: 'input',
                    name: 'newDataSourceShortname',
                    message: 'New data source shortname'
                },
                {
                    when: function (answers) {
                        return answers.dataSourceId === '__newDataSource__';
                    },
                    type: 'input',
                    name: 'newDataSourceName',
                    message: 'New data source name'
                }
            ]);
            if (answers.dataSourceId === '__newDataSource__') {
                const newDs = {
                    shortname: answers.newDataSourceShortname,
                    name: answers.newDataSourceName,
                    type: 'zones' as const,
                    data: {},
                    id: uuidV4()
                };
                await dsQueries.create(newDs);
                datasource = await dsQueries.read(newDs.id);
            } else {
                datasource = zonesDs.find((ds) => ds.id === answers.dataSourceId);
                await zonesQueries.deleteForDataSourceId(answers.dataSourceId);
            }
        }
        return (datasource as DataSourceAttributes).id;
    };

    private importZones = async (
        geojsonData: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
        dataSourceId: string
    ): Promise<boolean> => {
        // Ask which properties to use as zone shortname and name
        const firstFeature = geojsonData.features[0];
        const properties = Object.keys(firstFeature.properties || {});

        let shortnameProperty: string | undefined = undefined;
        let nameProperty: string | undefined = undefined;
        if (properties.length === 1) {
            shortnameProperty = properties[0];
            nameProperty = properties[0];
        } else if (properties.length > 1) {
            const geojsonAttributesChoices = properties.map((attribute) => {
                return {
                    value: attribute,
                    name: `${attribute} (${(firstFeature.properties || {})[attribute]})`
                };
            });
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'shortnameAttribute',
                    message: 'What is the attribute for each zone shortname?',
                    choices: geojsonAttributesChoices,
                    pageSize: Math.min(geojsonAttributesChoices.length, 20)
                },
                {
                    type: 'list',
                    name: 'nameAttribute',
                    message: 'What is the attribute for each zone name?',
                    choices: geojsonAttributesChoices,
                    pageSize: Math.min(geojsonAttributesChoices.length, 20)
                }
            ]);
            shortnameProperty = answers.shortnameAttribute;
            nameProperty = answers.nameAttribute;
        }
        const zoneAttributes = geojsonData.features.map((zone, index) => ({
            geography: zone.geometry,
            shortname:
                shortnameProperty === undefined
                    ? `Z${index}`
                    : String((zone.properties || {})[shortnameProperty]).substring(0, 30),
            name: nameProperty === undefined ? `Z${index}` : String((zone.properties || {})[nameProperty]),
            dataSourceId,
            internal_id: zone.id === undefined ? undefined : String(zone.id),
            data: zone.properties || {},
            id: uuidV4()
        }));
        await zonesQueries.createMultiple(zoneAttributes);
        return true;
    };

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        // Handle arguments and default values
        const name = argv['name'] !== undefined ? (argv['name'] as string) : undefined;
        const shortname = argv['shortname'] !== undefined ? (argv['shortname'] as string) : undefined;
        const zonesFile = argv['zones-file'] !== undefined ? (argv['zones-file'] as string) : undefined;

        const geojsonData = await this.getGeojsonData(zonesFile);
        const dataSourceId = await this.getDataSourceConfig({ dsName: name, dsShortname: shortname });
        await this.importZones(geojsonData, dataSourceId);
    }
}
