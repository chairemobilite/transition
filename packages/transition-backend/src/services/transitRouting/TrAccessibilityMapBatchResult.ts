/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import _omit from 'lodash/omit';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { TransitDemandFromCsvAccessMapAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitAccessibilityMapWithPolygonResult } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import { AccessibilityMapLocation } from 'transition-common/lib/services/accessibilityMap/AccessibiltyMapLocation';
import { unparse } from 'papaparse';
import { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';

type BaseAccessMapResults = {
    id: string;
    locationLat: number;
    locationLon: number;
    timeOfTrip: number;
    timeType: 'departure' | 'arrival';
    status: 'success' | 'error';
    [key: string]: string | number;
};

export interface BatchAccessibilityMapResultProcessor {
    processResult: (
        location: AccessibilityMapLocation,
        resultStatus: Status.Status<TransitAccessibilityMapWithPolygonResult>
    ) => void;
    end: () => void;
    getFiles: () => { csv?: string; geojson?: string };
}

/**
 * Factory method to create a batch accessibility map result processor to files
 *
 * @param absoluteDirectory Directory, relative to the project directory,
 * where to save the result files
 */
export const createAccessMapFileResultProcessor = (
    absoluteDirectory: string,
    parameters: TransitDemandFromCsvAccessMapAttributes,
    accessMapAttributes: AccessibilityMapAttributes
): BatchAccessibilityMapResultProcessor => {
    return new BatchAccessibilityMapResultProcessorFile(absoluteDirectory, parameters, accessMapAttributes);
};

const CSV_FILE_NAME = 'batchAccessMapResults.csv';
const GEOMETRY_FILE_NAME = 'batchAccessMapGeometryResults.geojson';

class BatchAccessibilityMapResultProcessorFile implements BatchAccessibilityMapResultProcessor {
    private readonly resultsCsvFilePath = `${this.absoluteDirectory}/${CSV_FILE_NAME}`;
    private readonly resultsGeojsonGeometryFilePath = `${this.absoluteDirectory}/${GEOMETRY_FILE_NAME}`;
    private _csvStream: fs.WriteStream | undefined = undefined;
    private _csvDetailedStream: fs.WriteStream | undefined = undefined;
    private _geometryStream: fs.WriteStream | undefined = undefined;
    private _geometryFileHasData = false;

    /**
     *
     * @param absoluteDirectory Absolute directory where to save the result
     * files
     */
    constructor(
        private absoluteDirectory: string,
        private parameters: TransitDemandFromCsvAccessMapAttributes,
        private accessMapAttributes: AccessibilityMapAttributes
    ) {
        this.initResultFiles();
    }

    private initResultFiles = () => {
        directoryManager.createDirectoryIfNotExistsAbsolute(`${this.absoluteDirectory}`);

        // TODO Add more attributes
        const csvAttributes: BaseAccessMapResults = {
            id: '',
            locationLat: 0,
            locationLon: 0,
            timeOfTrip: 0,
            timeType: 'arrival',
            status: 'success'
        };
        const numberOfPolygons = this.accessMapAttributes.numberOfPolygons || 1;
        const polygonAttributes = {};
        for (let i = 0; i < numberOfPolygons; i++) {
            polygonAttributes[`polygon${i}Duration`] = 0;
            polygonAttributes[`polygon${i}AreaSqKm`] = 0;
            polygonAttributes[`polygon${i}Geojson`] = '';
        }

        fileManager.writeFileAbsolute(this.resultsCsvFilePath, '');
        this._csvStream = fs.createWriteStream(this.resultsCsvFilePath);
        this._csvStream.on('error', console.error);
        this._csvStream.write(Object.keys(Object.assign(csvAttributes, polygonAttributes)).join(',') + '\n');

        if (this.parameters.withGeometries) {
            fileManager.writeFileAbsolute(this.resultsGeojsonGeometryFilePath, '');
            this._geometryStream = fs.createWriteStream(this.resultsGeojsonGeometryFilePath);
            this._geometryStream.on('error', console.error);
            this._geometryStream.write('{ "type": "FeatureCollection", "features": [');
        }
    };

    processResult = (
        location: AccessibilityMapLocation,
        resultStatus: Status.Status<TransitAccessibilityMapWithPolygonResult>
    ) => {
        const csvResults: BaseAccessMapResults = {
            id: location.id,
            locationLat: location.geography.coordinates[1],
            locationLon: location.geography.coordinates[0],
            timeOfTrip: location.timeOfTrip,
            timeType: location.timeType,
            status: Status.isStatusOk(resultStatus) ? 'success' : 'error'
        };

        if (Status.isStatusOk(resultStatus)) {
            this.processSuccessResult(csvResults, Status.unwrap(resultStatus));
        } else {
            this.processErrorResult(csvResults);
        }
    };

    getFiles = () => {
        const files: { csv?: string; geojson?: string } = {};
        if (this._csvStream) {
            files.csv = CSV_FILE_NAME;
        }
        if (this._geometryStream) {
            files.geojson = GEOMETRY_FILE_NAME;
        }
        return files;
    };

    private processSuccessResult = (
        csvResults: BaseAccessMapResults,
        results: TransitAccessibilityMapWithPolygonResult
    ) => {
        // Add data for each polygon in the csvResults
        const polygonAttributes = {};
        for (let i = 0; i < results.polygons.features.length; i++) {
            polygonAttributes[`polygon${i}Duration`] = results.polygons.features[i].properties?.durationMinutes;
            polygonAttributes[`polygon${i}AreaSqKm`] = results.polygons.features[i].properties?.areaSqKm;
            polygonAttributes[`polygon${i}Geojson`] = JSON.stringify(_omit(results.polygons.features[i], 'properties'));
        }
        if (this._csvStream) {
            this._csvStream.write(unparse([Object.assign(csvResults, polygonAttributes)], { header: false }) + '\n');
        }

        if (this._geometryStream) {
            // Write the geometry in the stream
            this._geometryStream.write(
                (this._geometryFileHasData ? ',\n' : '') +
                    results.polygons.features.map((geometry) => JSON.stringify(geometry)).join(',\n')
            );
            this._geometryFileHasData = true;
        }

        // TODO Do we need a detailed file?
    };

    private processErrorResult = (csvResults: BaseAccessMapResults) => {
        // Save this error result
        if (this._csvStream) {
            this._csvStream.write(unparse([csvResults], { header: false }) + '\n');
        }
    };

    end = () => {
        if (this._csvStream) {
            this._csvStream.end();
        }
        if (this._csvDetailedStream) {
            this._csvDetailedStream.end();
        }
        if (this._geometryStream) {
            this._geometryStream.write(']}');
            this._geometryStream.end();
        }
    };
}
