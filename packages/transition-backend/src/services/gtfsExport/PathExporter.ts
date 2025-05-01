/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';
import { unparse } from 'papaparse';

import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import Path from 'transition-common/lib/services/path/Path';
import dbQueries from '../../models/db/transitPaths.db.queries';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

const objectToGtfs = (path: Path, includeCustomFields = false): GtfsTypes.Shapes[] => {
    // will export an array of shape data, shape_id = path_id

    const shapeData: GtfsTypes.Shapes[] = [];
    const pathId = path.getId();

    const routingMode = path.attributes.data.routingMode;
    const routingEngine = path.attributes.data.routingEngine;

    const geography = path.attributes.geography;
    if (!geography || !geography.coordinates) {
        return [];
    }

    const coordinates = geography.coordinates;
    const distanceTraveledMeters = path.getCoordinatesDistanceTraveledMeters();

    for (let i = 0, count = distanceTraveledMeters.length; i < count; i++) {
        const distanceMeters = distanceTraveledMeters[i];
        const shapePoint = {
            shape_id: pathId,
            shape_pt_lat: coordinates[i][1],
            shape_pt_lon: coordinates[i][0],
            shape_pt_sequence: i,
            shape_dist_traveled: Math.round(distanceMeters) / 1000
        };
        if (includeCustomFields) {
            (shapePoint as any).tr_shape_routing_mode = routingMode;
            (shapePoint as any).tr_shape_routing_engine = routingEngine;
        }
        shapeData.push(shapePoint);
    }

    return shapeData;
};

export const exportPath = async (
    pathIds: string[],
    options: { directoryPath: string; quotesFct: (value: unknown) => boolean; includeTransitionFields?: boolean }
): Promise<{ status: 'success' } | { status: 'error'; error: unknown }> => {
    // Prepare the file stream
    const filePath = `${options.directoryPath}/${gtfsFiles.shapes.name}`;
    fileManager.truncateFileAbsolute(filePath);
    const shapeStream = fs.createWriteStream(filePath);

    // Fetch the path collection
    const paths = await dbQueries.geojsonCollection();
    const pathCollection = new PathCollection([], {});
    pathCollection.loadFromCollection(paths.features);

    try {
        const gtfsShapes = pathIds.map((pathId) => {
            const pathGeojson = pathCollection.getById(pathId);
            if (!pathGeojson) {
                throw new TrError(`Unknow path for GTFS export ${pathId}`, 'GTFSEXP0002');
            }
            const path = pathCollection.newObject(pathGeojson);
            const gtfsShape = objectToGtfs(path, options.includeTransitionFields || false);
            return gtfsShape;
        });
        const gtfsShapesFlat = gtfsShapes.flatMap((shape) => shape);
        // Write the agencies to the gtfs file
        shapeStream.write(
            unparse(gtfsShapesFlat, {
                newline: '\n',
                quotes: options.quotesFct,
                header: true
            })
        );
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', error };
    } finally {
        shapeStream.end();
    }
};
