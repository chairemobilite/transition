/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { DataBase } from './dataBase';
import GeoJSON from 'geojson';

export class DataGeojson extends DataBase<GeoJSON.Feature> {
    private _data: GeoJSON.Feature[];

    constructor(data: GeoJSON.GeoJSON) {
        super();
        this._data =
            data.type === 'FeatureCollection'
                ? data.features
                : data.type === 'Feature'
                    ? [data]
                    : [{ type: 'Feature', geometry: data, properties: {} }];
    }

    protected objectMatches(element: GeoJSON.Feature, data: { [key: string]: any }): boolean {
        const properties = element.properties || {};
        const { id, ...otherData } = data;
        const matches = super.innerObjectMatches(properties, otherData);
        if (matches && id) {
            if (!element.id) {
                return false;
            }
            const ids = Array.isArray(id) ? id : [id];
            return ids.includes(element.id);
        }
        return matches;
    }

    protected getData(): GeoJSON.Feature[] {
        return this._data;
    }
}

export class DataFileGeojson extends DataGeojson {
    private _fileData: GeoJSON.Feature[] | undefined = undefined;
    private _fileManager: any;
    private _filename: string;

    constructor(filename: string, fileManager: any) {
        super({ type: 'FeatureCollection', features: [] });
        this._filename = filename;
        this._fileManager = fileManager;
    }

    protected getData(): GeoJSON.Feature[] {
        if (!this._fileData) {
            try {
                const jsonData: GeoJSON.GeoJSON = JSON.parse(this._fileManager.readFileAbsolute(this._filename));
                this._fileData =
                    jsonData.type === 'FeatureCollection'
                        ? jsonData.features
                        : jsonData.type === 'Feature'
                            ? [jsonData]
                            : [{ type: 'Feature', geometry: jsonData, properties: {} }];
            } catch (error) {
                console.error('Error reading geojson data file ' + this._filename, error);
            }
        }
        return this._fileData || [];
    }
}
