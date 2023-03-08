/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';

import { TransitBatchRoutingDemandFromCsvAttributes } from 'chaire-lib-common/lib/api/TrRouting';
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
import { getDefaultCsvAttributes, getDefaultStepsAttributes } from './ResultAttributes';
import { OdTripRouteOutput } from './types';

const CSV_FILE_NAME = 'batchRoutingResults.csv';
const DETAILED_CSV_FILE_NAME = 'batchRoutingDetailedResults.csv';
const GEOMETRY_FILE_NAME = 'batchRoutingGeometryResults.geojson';

export interface BatchRoutingResultProcessor {
    processResult: (routingResult: OdTripRouteOutput) => void;
    end: () => void;
    getFiles: () => { input: string; csv?: string; detailedCsv?: string; geojson?: string };
}

/**
 * Factory method to create a batch routing result processor to files
 *
 * @param absoluteDirectory Directory, relative to the project directory,
 * where to save the result files
 */
export const createRoutingFileResultProcessor = (
    absoluteDirectory: string,
    parameters: TransitBatchRoutingDemandFromCsvAttributes,
    routing: TransitRouting,
    inputFileName: string
): BatchRoutingResultProcessor => {
    return new BatchRoutingResultProcessorFile(absoluteDirectory, parameters, routing, inputFileName);
};

class BatchRoutingResultProcessorFile implements BatchRoutingResultProcessor {
    private readonly resultsCsvFilePath = `${this.absoluteDirectory}/${CSV_FILE_NAME}`;
    private readonly resultsCsvDetailedFilePath = `${this.absoluteDirectory}/${DETAILED_CSV_FILE_NAME}`;
    private readonly resultsGeojsonGeometryFilePath = `${this.absoluteDirectory}/${GEOMETRY_FILE_NAME}`;
    private readonly inputFile = `${this.absoluteDirectory}/${this.inputFileName}`;
    private csvStream: fs.WriteStream | undefined;
    private csvDetailedStream: fs.WriteStream | undefined;
    private geometryStream: fs.WriteStream | undefined;
    private geometryStreamHasData = false;

    constructor(
        private absoluteDirectory: string,
        private parameters: TransitBatchRoutingDemandFromCsvAttributes,
        private routing: TransitRouting,
        private inputFileName: string
    ) {
        this.initResultFiles();
    }
    private initResultFiles = () => {
        const csvAttributes = getDefaultCsvAttributes(this.routing.attributes.routingModes || []);

        this.csvStream = fs.createWriteStream(this.resultsCsvFilePath);
        this.csvStream.on('error', console.error);
        this.csvStream.write(Object.keys(csvAttributes).join(',') + '\n');
        if (this.parameters.detailed) {
            this.csvDetailedStream = fs.createWriteStream(this.resultsCsvDetailedFilePath);
            this.csvDetailedStream.on('error', console.error);
            this.csvDetailedStream.write(Object.keys(getDefaultStepsAttributes()).join(',') + '\n');
        }
        if (this.parameters.withGeometries) {
            this.geometryStream = fs.createWriteStream(this.resultsGeojsonGeometryFilePath);
            this.geometryStream.on('error', console.error);
            this.geometryStream.write('{ "type": "FeatureCollection", "features": [');
        }
    };

    processResult = (routingResult: OdTripRouteOutput) => {
        if (this.geometryStream && routingResult.geometries && routingResult.geometries.length > 0) {
            // Write the geometry in the stream
            this.geometryStream.write(
                (this.geometryStreamHasData ? ',\n' : '\n') +
                    routingResult.geometries.map((geometry) => JSON.stringify(geometry)).join(',\n')
            );
            this.geometryStreamHasData = true;
        }
        if (this.csvStream && routingResult.csv && routingResult.csv.length > 0) {
            this.csvStream.write(routingResult.csv.join('\n') + '\n');
        }
        if (this.csvDetailedStream && routingResult.csvDetailed && routingResult.csvDetailed.length > 0) {
            this.csvDetailedStream.write(routingResult.csvDetailed.join('\n') + '\n');
        }
    };

    end = () => {
        if (this.csvStream) {
            this.csvStream.end();
        }
        if (this.csvDetailedStream) {
            this.csvDetailedStream.end();
        }
        if (this.geometryStream) {
            this.geometryStream.write('\n]}');
            this.geometryStream.end();
        }
    };

    getFiles = () => ({
        input: this.inputFileName,
        csv: CSV_FILE_NAME,
        detailedCsv: this.parameters.detailed ? DETAILED_CSV_FILE_NAME : undefined,
        geojson: this.parameters.withGeometries ? GEOMETRY_FILE_NAME : undefined
    });
}
