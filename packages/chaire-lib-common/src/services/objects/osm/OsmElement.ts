/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export default class OsmElement {
    private _id: number;
    private _type: string;
    private _geojson?: GeoJSON.Feature;
    private _tags?: { [key: string]: any };

    // geojsonData is required for ways
    constructor(jsonElementData: { [key: string]: any }, geojson?: GeoJSON.Feature) {
        this._id = jsonElementData.id;
        this._type = jsonElementData.type;
        this._geojson = geojson || undefined;
        this._tags = jsonElementData.tags || undefined;
    }

    /*fromGeojson(geojson: GeoJSON.Feature) {
        const new OsmElement({
            id: geojson.properties.id,
        });
    }*/
}
