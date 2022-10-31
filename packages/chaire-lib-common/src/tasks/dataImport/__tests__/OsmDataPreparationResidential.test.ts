/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import each from 'jest-each';
import fs               from 'fs';
import { DataFileOsmRaw, DataOsmRaw } from '../data/dataOsmRaw';
import { DataFileGeojson, DataGeojson } from '../data/dataGeojson';
import OsmDataPreparationResidential from '../OsmDataPreparationResidential';
import { GeojsonOutputter } from '../osmImportUtils';

const numberCompare = (n1: number, n2: number) => n1 > n2 ? 1 : n1 < n2 ? -1 : 0;

const geojsonCompare = (element1: GeoJSON.Feature, element2: GeoJSON.Feature) => {
    if (element1.geometry.type !== element2.geometry.type) {
        return element1.geometry.type.localeCompare(element2.geometry.type);
    }
    if (element1.geometry.type === 'Point') {
        const coord1 = element1.geometry.coordinates;
        const coord2 = (element2.geometry as GeoJSON.Point).coordinates;
        return coord1[0] === coord2[0] ? numberCompare(coord1[1], coord2[1]) : numberCompare(coord1[0], coord2[0]);
    }
    return 0;
}

const getData = (dir: string): { osmRawData: DataOsmRaw, osmGeojsonData: DataGeojson } => {
    return {
        osmRawData: new DataFileOsmRaw(
            '',
            { readFileAbsolute: () => fs.readFileSync(`${__dirname}/imports/${dir}/osmRawData.json`) }
        ),
        osmGeojsonData: new DataFileGeojson(
            '',
            { readFileAbsolute: () => fs.readFileSync(`${__dirname}/imports/${dir}/osmData.geojson`) }
        )
    }
}

each([
    ['residential-zone-without-building-count-matches'],
    ['residential-zone-with-building-count-matches']
]).test('Test Residential Area: %s', async (testDir) => {
    const { osmRawData, osmGeojsonData } = getData(testDir);

    const residentialDataPreparation = new OsmDataPreparationResidential(new GeojsonOutputter());
    const { residentialEntrances, zonesWithResidences } = await residentialDataPreparation.run(
        osmRawData,
        osmGeojsonData
    );

    // Validate the entrances file
    let fileContent = fs.readFileSync(`${__dirname}/imports/${testDir}/residentialEntrances.geojson`);
    expect(fileContent).not.toBeNull();
    let expectedFeatures = JSON.parse(fileContent.toString() as string).features;
    expectedFeatures = expectedFeatures.map(f => {return {...f , id: expect.any(String)}});
    expect(residentialEntrances.sort(geojsonCompare)).toEqual(expectedFeatures.sort(geojsonCompare));

    // Validte the zones data
    fileContent = fs.readFileSync(`${__dirname}/imports/${testDir}/residentialZones.geojson`);
    expect(fileContent).not.toBeNull();
    expectedFeatures = JSON.parse(fileContent.toString() as string).features;
    expectedFeatures = expectedFeatures.map(f => {return {...f , id: expect.any(String)}});
    expect(zonesWithResidences.sort(geojsonCompare)).toEqual(expectedFeatures.sort(geojsonCompare));

});
