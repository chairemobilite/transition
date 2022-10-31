/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericDataImportTask from './genericDataImportTask';
import { DataFileOsmRaw } from './data/dataOsmRaw';
import { DataFileGeojson } from './data/dataGeojson';
import { _toInteger } from '../../utils/LodashExtensions';
import OsmDataPreparationResidential from './OsmDataPreparationResidential';
import OsmDataPreparationNonResidential from './OsmDataPreparationNonResidential';

export default class PrepareOsmDataForImport extends GenericDataImportTask {
    private assertDataDownloaded(dataSourceDirectory: string): void {
        if (
            !(
                this.fileManager.fileExistsAbsolute(dataSourceDirectory + GenericDataImportTask.OSM_RAW_DATA_FILE) &&
                this.fileManager.fileExistsAbsolute(dataSourceDirectory + GenericDataImportTask.OSM_GEOJSON_FILE)
            )
        ) {
            throw new Error(
                'OSM data not available for data source. Please run the task to download the OSM data or put the ' +
                    GenericDataImportTask.OSM_RAW_DATA_FILE +
                    ' and ' +
                    GenericDataImportTask.OSM_GEOJSON_FILE +
                    ' in the directory ' +
                    dataSourceDirectory
            );
        }
    }

    /**
     * IN: The raw open street map data and the corresponding geojson data,
     * saved in files
     *
     * OUT: A file {@link GenericDataImportTask#RESIDENTIAL_ENTRANCES_FILE}
     * containing the residences building entrances (points), along with the
     * building they belong to; a file
     * {@link GenericDataImportTask#RESIDENTIAL_ZONES_FILE} with the zones with
     * residential buildings; a file
     * {@link GenericDataImportTask#POINT_OF_INTEREST_FILE} with the points of
     * interest locations for non-residential data
     * @param dataSourceDirectory The directory containing the data sources
     */
    protected async doRun(dataSourceDirectory: string): Promise<void> {
        const absoluteDsDir = this._importDir + dataSourceDirectory + '/';
        this.assertDataDownloaded(absoluteDsDir);

        const osmRawData = new DataFileOsmRaw(
            absoluteDsDir + GenericDataImportTask.OSM_RAW_DATA_FILE,
            this.fileManager
        );
        const osmGeojsonData = new DataFileGeojson(
            absoluteDsDir + GenericDataImportTask.OSM_GEOJSON_FILE,
            this.fileManager
        );

        // Calculate residential data if required
        const entrancesDataFile = absoluteDsDir + GenericDataImportTask.RESIDENTIAL_ENTRANCES_FILE;
        const residentialZoneDataFile = absoluteDsDir + GenericDataImportTask.RESIDENTIAL_ZONES_FILE;
        const overwriteIfExistsResEntrances = await this.promptOverwriteIfExists(
            entrancesDataFile,
            'Residential entrances file'
        );
        const overwriteIfExistsResZones = await this.promptOverwriteIfExists(
            residentialZoneDataFile,
            'Residential zones file'
        );
        if (overwriteIfExistsResEntrances || overwriteIfExistsResZones) {
            const residentialDataPreparation = new OsmDataPreparationResidential(this._geojsonOutputter);
            const { residentialEntrances, zonesWithResidences } = await residentialDataPreparation.run(
                osmRawData,
                osmGeojsonData
            );
            if (overwriteIfExistsResEntrances) {
                this.fileManager.writeFileAbsolute(
                    entrancesDataFile,
                    JSON.stringify({ type: 'FeatureCollection', features: residentialEntrances })
                );
            }
            if (overwriteIfExistsResZones) {
                this.fileManager.writeFileAbsolute(
                    residentialZoneDataFile,
                    JSON.stringify({ type: 'FeatureCollection', features: zonesWithResidences })
                );
            }
        } else {
            console.log('Ignoring pre-calculated residential');
        }

        const pointOfInterestDataFile = absoluteDsDir + GenericDataImportTask.POINT_OF_INTEREST_FILE;
        const overwriteIfExistsPoi = await this.promptOverwriteIfExists(
            pointOfInterestDataFile,
            'Point of interest file'
        );
        if (overwriteIfExistsPoi) {
            const pointsOfInterestPreparation = new OsmDataPreparationNonResidential(
                osmRawData,
                osmGeojsonData,
                this._geojsonOutputter
            );
            const { pointsOfInterest } = await pointsOfInterestPreparation.run();
            this.fileManager.writeFileAbsolute(
                pointOfInterestDataFile,
                JSON.stringify({ type: 'FeatureCollection', features: pointsOfInterest })
            );
        } else {
            console.log('Ignoring pre-calculated points of interest');
        }
    }
}
