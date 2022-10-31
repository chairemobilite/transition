/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericDataImportTask from './genericDataImportTask';

import osmDownloader from '../../utils/osm/OsmOverpassDownloader';
import { PromptGeojsonPolygonService } from '../../services/prompt/promptGeojsonService';

export default class DownloadOsmData extends GenericDataImportTask {
    private _promptPolygon: PromptGeojsonPolygonService;

    // TODO Use dependency injection to pass the prompter
    constructor(fileManager: any, promptPolygon: PromptGeojsonPolygonService) {
        super(fileManager);
        this._promptPolygon = promptPolygon;
    }

    /**
     * IN: A file containing the geojson polygon for which to fetch the Open
     * Street Map data
     *
     * OUT: Saves the downloaded Open Street Map raw data and geojson in files
     * {@link GenericDataImportTask#OSM_RAW_DATA_FILE} and
     * {@link GenericDataImportTask#OSM_GEOJSON_FILE}.
     * @param dataSourceDirectory The directory containing the data sources
     */
    protected async doRun(dataSourceDirectory: string): Promise<void> {
        // 1. Select dataSource from list or create a new data source
        // 2. use overpass API to fetch osm data in json format and convert all geo data to geojson using osmToGeojson package (done)
        // 3. Save json and geojson files to the project's imports/osm/[dataSourceId].json and imports/osm/[dataSourceId].geojson

        const absoluteDsDir = this._importDir + dataSourceDirectory + '/';
        const polygonGeojson = await this._promptPolygon.getPolygon(absoluteDsDir + 'polygon.geojson');
        try {
            const osmRawDataFile = absoluteDsDir + GenericDataImportTask.OSM_RAW_DATA_FILE;
            if (await this.promptOverwriteIfExists(osmRawDataFile, 'OpenStreeMap raw data file')) {
                const osmRawData = await osmDownloader.downloadJson(polygonGeojson);
                this.fileManager.writeFileAbsolute(osmRawDataFile, JSON.stringify(osmRawData));
            }
            const osmGeojson = absoluteDsDir + GenericDataImportTask.OSM_GEOJSON_FILE;
            if (await this.promptOverwriteIfExists(osmGeojson, 'OpenStreeMap geojson file')) {
                const osmGeojsonData = await osmDownloader.downloadGeojson(polygonGeojson);
                this.fileManager.writeFileAbsolute(osmGeojson, JSON.stringify(osmGeojsonData));
            }
        } catch (error) {
            throw new Error('Error retrieving Open Street Map data from server:' + JSON.stringify(error));
        }
    }
}
