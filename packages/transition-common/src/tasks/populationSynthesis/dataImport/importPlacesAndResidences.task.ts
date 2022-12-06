/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file is probably deprecated. It was written initially, but was later replaced by the files in chaire-lib-common/lib/tasks/dataImport */
import { validate as uuidValidate, v4 as uuidV4 } from 'uuid';
import inquirer from 'inquirer';
import inquirerFileTreeSelection from 'inquirer-file-tree-selection-prompt';

import { DataOsmRaw, DataFileOsmRaw } from 'chaire-lib-common/lib/tasks/dataImport/data/dataOsmRaw';
import { DataGeojson, DataFileGeojson } from 'chaire-lib-common/lib/tasks/dataImport/data/dataGeojson';
import { ResidentialDataImporter } from './importResidentialData';
import osmDownloader from 'chaire-lib-common/lib/utils/osm/OsmOverpassDownloader';
import config from 'chaire-lib-common/lib/config/shared/project.config';

inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);

async function getOsmData(preAnswers, fileManager) {
    let osmRawData, osmGeojsonData;
    if (preAnswers.osmSource === 'geojsonpoly') {
        let geojsonPolygon;
        try {
            geojsonPolygon = JSON.parse(fileManager.readFileAbsolute(preAnswers.polygonGeojson));
            if (
                !geojsonPolygon ||
                !geojsonPolygon.type ||
                !['FeatureCollection', 'Feature', 'Polygon'].includes(geojsonPolygon.type)
            ) {
                console.error('Invalid geojson polygon to fetch osm data in file', preAnswers.polygonGeojson);
                return { osmRawData, osmGeojsonData };
            }
        } catch (error) {
            console.error(
                'Error reading geojson polygon file. Verify that the file contains a geojson Polygon or a feature collection with the first feature as a polygon',
                preAnswers.polygonGeojson
            );
            return { osmRawData, osmGeojsonData };
        }
        try {
            osmRawData = new DataOsmRaw(await osmDownloader.downloadJson(geojsonPolygon));
            osmGeojsonData = new DataGeojson(await osmDownloader.downloadGeojson(geojsonPolygon));
        } catch (error) {
            console.error('Error retrieving Open Streem Map data from server:', error);
            return { osmRawData, osmGeojsonData };
        }
    } else {
        osmRawData = new DataFileOsmRaw(preAnswers.osmRawDataFilePath, fileManager);
        osmGeojsonData = new DataFileGeojson(preAnswers.osmGeojsonFilePath, fileManager);
    }
    return { osmRawData, osmGeojsonData };
}

async function run(fileManager: any) {
    const dataSources = []; //serviceLocator.collectionManager.get('dataSources').getFeatures();
    console.log('running');

    //choose data source shortname and name:
    const dataSourcesChoices: {
        name: string;
        value: string;
    }[] = []; /*dataSources.map(function(dataSource) {
        return {
            name: dataSource.toString(),
            value: dataSource.get('id')
        }
    }); */

    dataSourcesChoices.push({
        name: '--New data source--',
        value: '__newDataSource__'
    });

    const preAnswers = await inquirer.prompt([
        {
            type: 'list',
            name: 'osmSource',
            message: 'How should osm data be provided',
            choices: [
                {
                    name: 'Downloaded from a geojson Polygon in file',
                    value: 'geojsonpoly'
                },
                {
                    name: 'From json and geojson files in the import directory',
                    value: 'files'
                }
            ]
        },
        {
            when: function (answers) {
                return answers.osmSource === 'geojsonpoly';
            },
            type: 'file-tree-selection',
            name: 'polygonGeojson',
            message: 'Please select the file containing the polygon (must be placed in the project\'s imports folder)',
            root: `projects/${config.projectShortname}/imports/`,
            pageSize: 20
        },
        {
            when: function (answers) {
                return answers.osmSource === 'files';
            },
            type: 'file-tree-selection',
            name: 'osmRawDataFilePath',
            message: 'Please select the OSM raw data json file (must be placed in the project\'s imports folder)',
            root: `projects/${config.projectShortname}/imports/`,
            pageSize: 20
        },
        {
            when: function (answers) {
                return answers.osmSource === 'files';
            },
            type: 'file-tree-selection',
            name: 'osmGeojsonFilePath',
            message: 'Please select the OSM geojson file (must be placed in the project\'s imports folder)',
            root: `projects/${config.projectShortname}/imports/`,
            pageSize: 20
        },
        {
            type: 'file-tree-selection',
            name: 'landRoleGeojsonFilePath',
            message:
                'Please select the geojson file for the land role (must be placed in the project\'s imports folder)',
            root: `projects/${config.projectShortname}/imports/`,
            pageSize: 20
        }
    ]);

    const { osmRawData, osmGeojsonData } = await getOsmData(preAnswers, fileManager);
    if (!osmRawData || !osmGeojsonData) {
        return;
    }

    const landRoleData = new DataFileGeojson(preAnswers.landRoleGeojsonFilePath, fileManager);

    const residentialImporter = new ResidentialDataImporter(osmRawData, osmGeojsonData, landRoleData);
    const allResidences = await residentialImporter.createResidentialDataSource('test data source');
    console.log('Residences', allResidences.length);
    /*
    if (geojson && geojson.type === 'FeatureCollection' && geojson.features && geojson.features.length > 0)
    {

    const geojsonAttributesChoices = Object.keys(geojson.features[0].properties).map(function(attribute) {
        return {
            value: attribute,
            name : attribute
        };
    });

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'dataSourceId',
            message: 'Please select a data source (zones will be replaced) or create a new one for the zones',
            choices: dataSourcesChoices
        },
        {
            when: function(answers) {
                return answers.dataSourceId === '__newDataSource__';
            },
            type: 'input',
            name: 'newDataSourceShortname',
            message: 'New data source shortname'
        },
        {
            when: function(answers) {
                return answers.dataSourceId === '__newDataSource__';
            },
            type: 'input',
            name: 'newDataSourceName',
            message: 'New data source name'
        },
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

    // TODO: Save it to DB
    let dataSourceId = answers.dataSourceId;

    if (dataSourceId === '__newDataSource__' && answers.newDataSourceName && answers.newDataSourceShortname)
    {
        const dataSource = new DataSource({
            id       : uuidV4(),
            shortname: answers.newDataSourceShortname,
            name     : answers.newDataSourceName
        }, true, serviceLocator.collectionManager);

        dataSourceId = dataSource.get('id');

        await dataSourcesDbQueries.create(dataSource.attributes);
        console.log(`data source ${dataSourceId} saved to db`);

        const dataSourceCacheFilePath = await dataSourceCollectionToCache(serviceLocator.collectionManager.get('dataSources'));
        console.log(`data source ${dataSourceId} saved to cache (${dataSourceCacheFilePath})`);

    }
    else
    {
        console.log('deleting existing zones for the selected data source');
        await zonesDbQueries.deleteForDataSourceId(dataSourceId);
    }

    const zones = [];

    for (let i = 0, count = geojson.features.length; i < count; i++)
    {
        const feature      = geojson.features[i];
        feature.properties = feature.properties || {};

        let uuid = null;
        if (uuidValidate(feature.properties.id))
        {
        uuid = feature.properties.id;
        }
        else if (uuidValidate(feature.properties.uuid))
        {
        uuid = feature.properties.uuid;
        }
        else
        {
        uuid = uuidV4();
        }
        const shortname = feature.properties[answers.shortnameAttribute] || null;
        const name      = feature.properties[answers.nameAttribute]      || null;
        const attributes = {
        id            : uuid,
        data_source_id: dataSourceId,
        shortname,
        name,
        data     : feature.properties,
        geography: feature.geometry
        };

        const zone = new Zone(attributes);
        zones.push(zone);

        console.log(`  parsed feature ${i + 1} / ${count} (${attributes.shortname})`);

    }

    serviceLocator.collectionManager.add('zones', new ZoneCollection(zones))

    await updateCollection('zones', dataSourceId, serviceLocator.collectionManager.get('zones').getFeatures(), loadZoneCollection, zonesDbQueries, zoneCollectionToCache, true);

    return;

    }
    else
    {
    console.error('geojson file is malformed or does not contain a FeatureCollection');
    return;
    }
 */
}

export default run;
