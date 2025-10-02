/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericDataImportTask from 'chaire-lib-backend/lib/tasks/dataImport/genericDataImportTask';
import importGeojsonPlaces from '../../services/importers/PlacesDataSourceImporter';

export default class ImportPlacesFromGeojson extends GenericDataImportTask {
    constructor(fileManager: any) {
        super(fileManager);
    }

    /**
     * IN: A file {@link GenericDataImportTask#POINT_OF_INTEREST_FILE} and
     * {@link GenericDataImportTask#RESIDENTIAL_ENTRANCES_FILE} containing the
     * residences and poi points
     *
     * OUT: The tr_places table is populated with the data from the geojson files
     *
     * @param dataSourceDirectory The directory containing the data sources
     */
    protected async doRun(dataSourceDirectory: string): Promise<void> {
        // Import from the point of interest file
        const absoluteDsDir = this._importDir + dataSourceDirectory + '/';
        const POIgeojsonFilePath = absoluteDsDir + GenericDataImportTask.POINT_OF_INTEREST_FILE;
        const dataSourceName = `${dataSourceDirectory} Places`;

        await importGeojsonPlaces(POIgeojsonFilePath, dataSourceName);

        const residencesGeojsonFilePath = absoluteDsDir + GenericDataImportTask.RESIDENTIAL_ENTRANCES_FILE;
        const residenceDataSourceName = `${dataSourceDirectory} Residences`;

        await importGeojsonPlaces(residencesGeojsonFilePath, residenceDataSourceName);
    }
}
