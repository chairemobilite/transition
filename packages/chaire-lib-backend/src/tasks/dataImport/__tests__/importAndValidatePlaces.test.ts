/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs               from 'fs';

import importAndValidatePlaces from '../importAndValidatePlaces';
import { PromptGeojsonPolygonService } from '../../../services/prompt/promptGeojsonService';


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

class importAndValidatePlacesStub extends importAndValidatePlaces {
    promptOverwriteIfExists = (absoluteFilePath, message) => new Promise<boolean>((resolve) => {resolve(true)});
}

class StubGeojsonPolygonService implements PromptGeojsonPolygonService {

    async getPolygon(defaultFileName: string) {
        return {
            "type": "FeatureCollection" as const,
            "features": []
        };
    }

    async getFeatureCollection(defaultFileName: string): Promise<GeoJSON.FeatureCollection> {
        let fileContent = fileManager.readFileAbsolute(defaultFileName);
        if (fileContent !== null) {
            return JSON.parse(fileContent);
        }
        throw "unknown file " + defaultFileName;
    }
};

const task = new importAndValidatePlacesStub(fileManager, new StubGeojsonPolygonService);

test('Test Residential Area', async () => {
    await task.run({ dataSourceId: 'residential-zone-without-building-count-matches' });
});

test('Test Residential Area With Building', async () => {
    // Some land role points are slightly off limit of the buildings, to make
    // sure the buffer matches works, and some are in the convex hull of
    // buildings
    await task.run({ dataSourceId: 'residential-zone-with-building-count-matches' });
});

test('Test Residential Area With Empty Buildings Building', async () => {
    // Same data as residential-zone-with-building-count-matches, but land role
    // points are all together in the same building
    await task.run({ dataSourceId: 'residential-zone-with-empty-building-count-matches' });
});

test('Test Residential Area Buildings Not In Landrole', async () => {
    // Same data as residential-zone-with-building-count-matches, but without
    // land role points in one of the buildings
    await task.run({ dataSourceId: 'residential-zone-with-empty-building-count-matches' });
});