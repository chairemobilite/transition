/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { fileSelector } from 'inquirer-file-selector';
import { Polygon, FeatureCollection, Feature } from 'geojson';

import { PromptGeojsonPolygonService, GeojsonServiceOptions } from './promptGeojsonService';
import { fileManager } from '../../utils/filesystem/fileManager';

export class CliPromptGeojsonPolygonService implements PromptGeojsonPolygonService {
    private _importDir: string | undefined;

    constructor(importDir: string | undefined) {
        this._importDir = importDir;
    }

    private async getFileName(
        defaultFileName: string,
        textMessage: string,
        options: GeojsonServiceOptions
    ): Promise<string> {
        const interactive = options.interactive === undefined ? true : options.interactive;
        let fileName: string = defaultFileName;
        if (!fileManager.fileExistsAbsolute(fileName)) {
            if (!interactive) {
                throw new Error('File does not exist: ' + fileName);
            }
            // Ask the user for the file containing the geojson polygon
            const selection = await fileSelector({
                message: textMessage,
                basePath: this._importDir,
                filter: (item) => item.isDirectory || item.name.endsWith('.geojson') || item.name.endsWith('.json')
            });
            fileName = selection.path;
        }
        return fileName;
    }

    async getPolygon(
        defaultFileName: string,
        options: GeojsonServiceOptions = {}
    ): Promise<Polygon | FeatureCollection | Feature> {
        const fileName = await this.getFileName(
            defaultFileName,
            'Please select the file containing the polygon (must be placed in the project\'s imports folder)',
            options
        );
        try {
            const fileContent = fileManager.readFileAbsolute(fileName);
            const geojsonPolygon = fileContent ? JSON.parse(fileContent) : undefined;
            if (
                !geojsonPolygon ||
                !geojsonPolygon.type ||
                !['FeatureCollection', 'Feature', 'Polygon'].includes(geojsonPolygon.type)
            ) {
                throw new TypeError('Invalid geojson polygon to fetch osm data in file' + fileName);
            }
            return geojsonPolygon;
        } catch {
            throw new Error(
                'Error reading geojson polygon file. Verify that the file contains a geojson Polygon or a feature collection with the first feature as a polygon: ' +
                    fileName
            );
        }
    }

    /**
     * Get a geojson feature collection.
     *
     * @param {string} defaultFileName A hint for the file name to get the
     * collection from
     * @return {*}  {Promise<GeoJSON.FeatureCollection>}
     */
    async getFeatureCollection(
        defaultFileName: string,
        options: GeojsonServiceOptions = {}
    ): Promise<FeatureCollection> {
        const fileName = await this.getFileName(
            defaultFileName,
            'Please select the file containing the geojson collection (must be placed in the project\'s imports folder)',
            options
        );
        try {
            const fileContent = fileManager.readFileAbsolute(fileName);
            const geojsonPolygon = fileContent ? JSON.parse(fileContent) : undefined;
            if (!geojsonPolygon || !geojsonPolygon.type || !(geojsonPolygon.type === 'FeatureCollection')) {
                throw new TypeError('Invalid geojson feature collection to fetch osm data in file' + fileName);
            }
            return geojsonPolygon;
        } catch {
            throw new Error(
                'Error reading geojson feature collection file. Verify that the file contains a geojson feature collection: ' +
                    fileName
            );
        }
    }
}
