/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';

import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GtfsInternalData, ShapeImportData } from './GtfsImportTypes';

import { GtfsObjectPreparator } from './GtfsObjectPreparator';

export class ShapeImporter implements GtfsObjectPreparator<GtfsTypes.Shapes> {
    private _filePath: string;

    constructor(options: { directoryPath: string }) {
        this._filePath = _isBlank(options.directoryPath)
            ? gtfsFiles.shapes.name
            : `${options.directoryPath}/${gtfsFiles.shapes.name}`;
    }

    private getShapeIdsToImport(trips: GtfsTypes.Trip[]): string[] {
        return trips
            .filter((trip) => !_isBlank(trip.shape_id))
            .map((trip) => trip.shape_id)
            .reduce((shapeIds, shapeId) => {
                if (shapeIds.indexOf(shapeId as string) === -1) {
                    shapeIds.push(shapeId as string);
                }
                return shapeIds;
            }, [] as string[]);
    }

    async prepareImportData(importData?: GtfsInternalData): Promise<GtfsTypes.Shapes[]> {
        if (!importData || !importData.tripsToImport || importData.tripsToImport.length === 0) {
            console.log('Not importing shapes, because there are no trips to import');
            return [];
        }
        const shapeIds = this.getShapeIdsToImport(importData.tripsToImport);
        const shapes: GtfsTypes.Shapes[] = [];
        await parseCsvFile(
            this._filePath,
            (data, rowNum) => {
                const { shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled } = data;
                // Ignores shapes not to import
                if (!shapeIds.includes(shape_id)) {
                    return;
                }
                const lat = parseFloat(shape_pt_lat);
                const lon = parseFloat(shape_pt_lon);
                const sequence = parseInt(shape_pt_sequence);
                const distance = parseFloat(shape_dist_traveled);
                // Warn and ignore if fields are invalid
                if (isNaN(lat) || isNaN(lon) || isNaN(sequence) || sequence < 0) {
                    console.log(`GTFS Shape import: Invalid data on row ${rowNum}`);
                    return;
                }
                const shape: GtfsTypes.Shapes = {
                    shape_id,
                    shape_pt_lat: lat,
                    shape_pt_lon: lon,
                    shape_pt_sequence: sequence
                };
                if (!isNaN(distance)) {
                    if (distance < 0) {
                        console.log(`GTFS Shape import: Negative distance on row ${rowNum}, ignoring`);
                    } else {
                        shape.shape_dist_traveled = distance;
                    }
                }

                shapes.push(shape);
            },
            { header: true }
        );
        return shapes;
    }

    static groupShapesById(shapes: GtfsTypes.Shapes[]): ShapeImportData {
        const shapeData: ShapeImportData = {};
        shapes.forEach((shape) => {
            const shapePoints = shapeData[shape.shape_id] || [];
            shapePoints.push(shape);
            shapeData[shape.shape_id] = shapePoints;
        });
        // Sort the shape points by sequence number
        Object.keys(shapeData).forEach((key) => {
            shapeData[key].sort(
                (coordinateA, coordinateB) => coordinateA.shape_pt_sequence - coordinateB.shape_pt_sequence
            );
        });
        return shapeData;
    }
}

export default ShapeImporter;
