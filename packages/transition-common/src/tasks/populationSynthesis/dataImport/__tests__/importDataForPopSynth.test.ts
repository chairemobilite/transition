/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { DataFileOsmRaw } from 'chaire-lib-common/lib/tasks/dataImport/data/dataOsmRaw';
import { DataFileGeojson } from 'chaire-lib-common/lib/tasks/dataImport/data/dataGeojson';
import { ResidentialDataImporter } from '../importResidentialData';
import fs               from 'fs';

const osmRawFileManager = { readFileAbsolute: () => fs.readFileSync(__dirname + '/unit_test_osm_raw_data.json')};
const osmRawData = new DataFileOsmRaw('unit_test_osm_raw_data', osmRawFileManager);
const geojsonFileManager = { readFileAbsolute: () => fs.readFileSync(__dirname + '/unit_test_osm_way_relation.geojson')};
const geojsonData = new DataFileGeojson('unit_test_osm_way_relation', geojsonFileManager);
const landRoleFileManager = { readFileAbsolute: () => fs.readFileSync(__dirname + '/unit_test_land_role.geojson')};
const landRoleData = new DataFileGeojson('unit_test_land_role', landRoleFileManager);

test('Test Residential Area', async () => {
    const residentialImporter = new ResidentialDataImporter(osmRawData, geojsonData, landRoleData);
    const allResidences = await residentialImporter.createResidentialDataSource('test data source');
    expect(allResidences.length).toBe(471);
});