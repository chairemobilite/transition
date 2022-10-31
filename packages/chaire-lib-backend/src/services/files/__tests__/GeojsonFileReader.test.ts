/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { parseGeojsonFileFeatures } from '../GeojsonFileReader';

const filePath = `${__dirname}/testFiles/featureCollection.geojson`;

let rows: any[] = [];
let rowNumbers: number[] = [];
const rowCallback = (row: any, rowNumber: number) => {
    rows.push(row);
    rowNumbers.push(rowNumber);
}

beforeEach(() => {
    rows = [];
    rowNumbers = [];
})

/** Test only the geojson files. The variety of inputs have been
 * tested in the json file reader tests */

test('Test features reader', async () => {
    const result = await parseGeojsonFileFeatures(filePath, rowCallback);
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(2);
    expect(rows[0]).toEqual({ 
        type: "Feature",
        properties: {},
        geometry: { coordinates: [-73.6724, 45.5588], type: "Point"}
    });
    expect(rows[1]).toEqual(expect.objectContaining({ 
        type: "Feature",
        properties: {},
        geometry: { coordinates: [[-73.6887, 45.515], [-73.68872, 45.51534]], type: "LineString" }
    }));
    expect(rowNumbers.length).toEqual(2);
    expect(rowNumbers).toEqual([0, 1]);
});

test('Test features reader, but not geojson collection', async () => {
    // Not a feature collection, the file should read all right, but there should not be any rows
    const result = await parseGeojsonFileFeatures(`${__dirname}/testFiles/featureArray.geojson`, rowCallback);
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(0);
});
