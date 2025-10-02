/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { DataBase } from './dataBase';
import GeoJSON from 'geojson';
import fs from 'fs';
import { pipeline } from 'node:stream/promises';
import JSONStream from 'JSONStream';

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

// Instead of reading the entire file at once, this class streams it asynchronously. This allows for large files to be read without crashing the application.
export class DataStreamGeojson extends DataGeojson {
    private _fileData: GeoJSON.Feature[] = [];
    private _filename: string;
    private _dataInitialized: boolean;

    private constructor(filename: string) {
        super({ type: 'FeatureCollection', features: [] });
        this._filename = filename;
        this._dataInitialized = false;
    }

    // Factory method so that we can create the class while calling an async function.
    // The proper way to do this would be to do it in getData(), but making that method async would force us to modify every class this inherits from, so we use this factory workaround.
    // TODO: Rewrite the class from scratch so that it accepts an async getData().
    static async create(filename: string): Promise<DataStreamGeojson> {
        const instance = new DataStreamGeojson(filename);
        await instance.streamDataFromFile();
        return instance;
    }

    protected getData(): GeoJSON.Feature[] {
        if (!this._dataInitialized) {
            console.error(
                'The GeoJSON data has not been properly initialized. The create() method must be called before anything else in the DataStreamGeojson class.'
            );
            throw 'GeoJSON data not initialized.';
        }
        return this._fileData;
    }

    private async streamDataFromFile(): Promise<void> {
        try {
            this._fileData = await this.readGeojsonData();
            this._dataInitialized = true;
        } catch (error) {
            console.error('Error reading GeoJSON data file ' + this._filename, error);
        }
    }

    private async readGeojsonData(): Promise<GeoJSON.Feature[]> {
        console.log('Start streaming GeoJSON data.');
        const readStream = fs.createReadStream(this._filename);
        const jsonParser = JSONStream.parse('features.*');
        const features: GeoJSON.Feature[] = [];

        return new Promise((resolve, reject) => {
            jsonParser.on('error', (error) => {
                console.error(error);
                reject(error);
            });

            jsonParser.on('data', (feature) => {
                features.push(feature);
            });

            jsonParser.on('end', () => {
                console.log('End of reading GeoJSON data.');
                resolve(features);
            });

            pipeline(readStream, jsonParser);
        });
    }
}
