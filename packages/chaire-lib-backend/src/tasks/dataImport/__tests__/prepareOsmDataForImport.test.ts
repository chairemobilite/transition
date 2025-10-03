/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import prepareOsmData from '../prepareOsmDataForImport';

import fs               from 'fs';

class TestFileManager {
    directoryManager = {
        projectDirectory: __dirname
    }

    readFileAbsolute(absoluteFilePath: string) {
        if (fs.existsSync(absoluteFilePath)) {
            return fs.readFileSync(absoluteFilePath).toString();
        }
        return null;
    }

    fileExistsAbsolute(absoluteFilePath: string) {
        return true;
    }

    writeFileAbsolute(absoluteFilePath: string, content: any, options = { flag: 'w' }) {
        let fileContent = this.readFileAbsolute(absoluteFilePath);
        console.log(absoluteFilePath);
        expect(fileContent).not.toBeNull();
        let expectedFeatures = JSON.parse(fileContent as string).features;
        expectedFeatures = expectedFeatures.map(f => {return {...f , id: expect.any(String)}});
        let actualFeatures = JSON.parse(content).features;
        expect(actualFeatures.sort(geojsonCompare)).toEqual(expectedFeatures.sort(geojsonCompare));
    }

}

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

const fileManager = new TestFileManager();

class prepareOsmDataStub extends prepareOsmData {
    promptOverwriteIfExists = (absoluteFilePath, message) => new Promise<boolean>((resolve) => {resolve(true)});
}

const task = new prepareOsmDataStub(fileManager);

test('Test Residential Area', async () => {
    await task.run({ dataSourceId: 'residential-zone-without-building-count-matches'});
});

test('Test Residential Area WithBuilding', async () => {
    await task.run({ dataSourceId: 'residential-zone-with-building-count-matches'});
});
