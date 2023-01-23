/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fetch from 'node-fetch';
import osmToGeojson from 'osmtogeojson';
import fs from 'fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import JSONStream from 'JSONStream';

import { geojsonToPolyBoundary } from '../geometry/ConversionUtils';
import allNodesXmlQuery from '../../config/osm/overpassQueries/allNodes';
import allWaysAndRelationsXmlQuery from '../../config/osm/overpassQueries/allWaysAndRelations';

export interface OsmOverpassDownloader {
    downloadJson(boundPoly: GeoJSON.Polygon, overpassXmlQueryString: string): Promise<JSON>; // boundary polygon should not have holes!
    downloadGeojson(boundPoly: GeoJSON.Polygon, overpassXmlQueryString: string): Promise<GeoJSON.FeatureCollection>; // same thing as downloadJson, but with a geojson converter
}

export type OsmOutputType = 'json' | 'xml';

class OsmOverpassDownloaderImpl implements OsmOverpassDownloader {
    private _apiUrl: string;

    constructor(apiUrl = null) {
        this._apiUrl = apiUrl || process.env.OSM_OVERPASS_API_URL || 'http://overpass-api.de/api/interpreter';
    }

    /**
     * Does the query to the overpass API. It will return a response only if the
     * query is a success, otherwise, it throws an error object with 'status'
     * being the response code.
     *
     * @private
     * @param {(GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature)}
     * boundPoly The polygon boundary
     * @param {*} [overpassXmlQueryString=allNodesXmlQuery] The overpass query
     * to request
     * @param {OsmOutputType} [output='json'] Requested output type
     * @return {*} Return the response from the API query, only if the response
     * code is 200 (success), otherwise, it will throw an error.
     * @memberof OsmOverpassDownloaderImpl
     */
    private async downloadData(
        boundPoly: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature,
        overpassXmlQueryString = allNodesXmlQuery,
        output: OsmOutputType = 'json'
    ) {
        const boundPolyFormattedString = geojsonToPolyBoundary(boundPoly);
        if (boundPolyFormattedString === false) {
            return {};
        }
        overpassXmlQueryString = overpassXmlQueryString
            .replace(/BOUNDARY/g, boundPolyFormattedString)
            .replace(/OUTPUT/g, output);
        console.log('Retrieving data from osm...');
        const response = await fetch(this._apiUrl, {
            method: 'POST',
            body: overpassXmlQueryString,
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        if (response.status !== 200) {
            throw {
                error: 'OverpassRequestError',
                status: response.status
            };
        }

        console.log('Done retrieving data from osm...');
        return response;
    }

    /**
     * Download data from openstreetmap API, and return in json format
     *
     * @param {(GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature)}
     * boundPoly The geojson polygon for which to fetch the data
     * @param {string} [overpassXmlQueryString=allNodesXmlQuery] The XML query to
     * run. Placeholders BOUNDARY and OUTPUT will be replaced respectively by
     * the polygon boundaries in parameter and the output type, here 'json'
     * @return {*} The result of the query, as a json object
     * @memberof OsmOverpassDownloaderImpl
     */
    public async downloadJson(
        boundPoly: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature,
        overpassXmlQueryString: string = allNodesXmlQuery
    ) {
        const response = await this.downloadData(boundPoly, overpassXmlQueryString, 'json');
        const jsonContent = await response.json();

        return jsonContent;
    }

    /**
     * Download data from openstreetmap API, and write it to a json file
     * If the file exist, it will be overwritten
     *
     * @param {string} Filename to write to
     * @param {(GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature)}
     * boundPoly The geojson polygon for which to fetch the data
     * @param {*} [overpassXmlQueryString=allNodesXmlQuery] The XML query to
     * run. Placeholders BOUNDARY and OUTPUT will be replaced respectively by
     * the polygon boundaries in parameter and the output type, here 'xml'
     * @return {*} The result of the query, as an xml string
     * @memberof OsmOverpassDownloaderImpl
     */
    public async fetchAndWriteJson(
        filename: string,
        boundPoly: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature,
        overpassXmlQueryString: string = allNodesXmlQuery
    ): Promise<boolean> {
        return this.fetchAndWrite(filename, boundPoly, overpassXmlQueryString, 'json');
    }

    /**
     * Download data from openstreetmap API, and return a geojson feature
     * collection
     *
     * @param {(GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature)}
     * boundPoly The geojson polygon for which to fetch the data
     * @param {string} [overpassXmlQueryString=allWaysAndRelationsXmlQuery] The
     * XML query to run. Placeholders BOUNDARY and OUTPUT will be replaced
     * respectively by the polygon boundaries in parameter and the output type,
     * here 'json'
     * @return {GeoJSON.FeatureCollection} The result of the query, as a geojson
     * feature collection
     * @memberof OsmOverpassDownloaderImpl
     */
    public async downloadGeojson(
        boundPoly: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature,
        overpassXmlQueryString: string = allWaysAndRelationsXmlQuery
    ): Promise<GeoJSON.FeatureCollection> {
        const jsonContent = await this.downloadJson(boundPoly, overpassXmlQueryString);

        return osmToGeojson(jsonContent) as GeoJSON.FeatureCollection;
    }

    /**
     * Download data from openstreetmap API, convert it to geojson and write it to
     * a geojson file. It does not reuse the generic write as we need to do a data
     * conversion to geojson using osmtogeojson in the middle of the stream.
     * If the file exist, it will be overwritten
     *
     * See downloadGeojson for params
     */
    public async fetchAndWriteGeojson(
        filename: string,
        boundPoly: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature,
        overpassXmlQueryString: string = allWaysAndRelationsXmlQuery
    ): Promise<boolean> {
        const response = await this.downloadData(boundPoly, overpassXmlQueryString, 'json');
        const streamPipeline = promisify(pipeline);

        console.log('Writing osm geojson data to ' + filename);

        // Inspired by a conversation with ChatGPT :)
        const writeStream = fs.createWriteStream(filename);
        const jsonStream = JSONStream.parse('elements.*');
        jsonStream.on('data', (element) => {
            const geojsonData = osmToGeojson({ elements: [element] });
            writeStream.write(JSON.stringify(geojsonData));
        });
        jsonStream.on('end', () => {
            writeStream.end();
        });
        await streamPipeline(response.body, jsonStream);
        console.log('Done writing osm geojson data');

        return true;
    }
    /**
     * Download data from openstreetmap API, and return an xml string of the result
     *
     * @param {(GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature)}
     * boundPoly The geojson polygon for which to fetch the data
     * @param {*} [overpassXmlQueryString=allNodesXmlQuery] The XML query to
     * run. Placeholders BOUNDARY and OUTPUT will be replaced respectively by
     * the polygon boundaries in parameter and the output type, here 'xml'
     * @return {*} The result of the query, as an xml string
     * @memberof OsmOverpassDownloaderImpl
     */
    public async downloadXml(
        boundPoly: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature,
        overpassXmlQueryString: string = allNodesXmlQuery
    ): Promise<string> {
        const response = await this.downloadData(boundPoly, overpassXmlQueryString, 'xml');
        const textContent = await response.text();

        return textContent;
    }

    /**
     * Download data from openstreetmap API, and write it to an XML file
     * If the file exist, it will be overwritten
     *
     * @param {string} Filename to write to
     * @param {(GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature)}
     * boundPoly The geojson polygon for which to fetch the data
     * @param {*} [overpassXmlQueryString=allNodesXmlQuery] The XML query to
     * run. Placeholders BOUNDARY and OUTPUT will be replaced respectively by
     * the polygon boundaries in parameter and the output type, here 'xml'
     * @return {*} The result of the query, as an xml string
     * @memberof OsmOverpassDownloaderImpl
     */
    public async fetchAndWriteXml(
        filename: string,
        boundPoly: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature,
        overpassXmlQueryString = allNodesXmlQuery
    ): Promise<boolean> {
        return this.fetchAndWrite(filename, boundPoly, overpassXmlQueryString, 'xml');
    }

    /**
     * Encapsulate write logic for both fetchAndWriteXml and fetchAndWriteJson function. Only the format changes
     */
    private async fetchAndWrite(
        filename: string,
        boundPoly: GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature,
        overpassXmlQueryString: string,
        fileType: 'xml' | 'json'
    ): Promise<boolean> {
        const response = await this.downloadData(boundPoly, overpassXmlQueryString, fileType);
        // Taken from fetch-node documentation
        const streamPipeline = promisify(pipeline);
        console.log('Writing osm data to ' + filename);
        await streamPipeline(response.body, fs.createWriteStream(filename));
        console.log('Done writing osm data');
        return true;
    }
}

// singleton:
const instance = new OsmOverpassDownloaderImpl();
export default instance;
