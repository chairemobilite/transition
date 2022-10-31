/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { unparse } from 'papaparse';

import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import Node from 'transition-common/lib/services/nodes/Node';
import dbQueries from '../../models/db/transitNodes.db.queries';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { GtfsStop } from 'transition-common/lib/services/gtfs/GtfsImportTypes';

const objectToGtfs = (node: Node, includeCustomFields = false): GtfsStop => {
    const attributes = node.attributes;
    const gtfsFields: GtfsStop = {
        stop_id: node.getId(), // required
        stop_code: attributes.code, // optional
        stop_name: attributes.name, // required
        stop_desc: attributes.description, // optional
        stop_lat: attributes.geography?.coordinates[1],
        stop_lon: attributes.geography?.coordinates[0],
        zone_id: undefined, // TODO: implement this?
        stop_url: attributes.data.gtfs?.stop_url, // optional
        location_type: 0, // 0: stop or platform, 1: station, 2: entrance/exit, 3: generic node in a station, 4: boarding area, TODO: specify that?
        parent_station: undefined, // TODO: waiting for station implementation, TODO: see https://developers.google.com/transit/gtfs/reference#stopstxt for more info on implementation
        stop_timezone: attributes.data.gtfs?.stop_timezone, // optional
        wheelchair_boarding: attributes.data.gtfs?.wheelchair_boarding, // optional, TODO: implement this field in Transition
        level_id: undefined, // optional, TODO: implement?
        platform_code: undefined // optional, TODO: implement platform id?
    };
    if (includeCustomFields) {
        gtfsFields.tr_node_color = attributes.color;
        gtfsFields.tr_routing_radius_meters = attributes.routing_radius_meters || 50;
        gtfsFields.tr_default_dwell_time_seconds = attributes.default_dwell_time_seconds || 20;
        gtfsFields.tr_can_be_used_as_terminal = attributes.data.canBeUsedAsTerminal;
    }
    return gtfsFields;
};

export const exportStop = async (
    nodeIds: string[],
    options: { directoryPath: string; quotesFct: (value: unknown) => boolean; includeTransitionFields?: boolean }
): Promise<{ status: 'success' } | { status: 'error'; error: unknown }> => {
    // Prepare the file stream
    const filePath = `${options.directoryPath}/${gtfsFiles.stops.name}`;
    fileManager.truncateFileAbsolute(filePath);
    const stopStream = fs.createWriteStream(filePath);

    // Fetch the nodes collection
    const nodes = await dbQueries.geojsonCollection();
    const nodeCollection = new NodeCollection([], {}, undefined);
    nodeCollection.loadFromCollection(nodes.features);

    try {
        const gtfsStops = nodeIds.map((nodeId) => {
            const nodeGeojson = nodeCollection.getById(nodeId);
            if (!nodeGeojson) {
                throw new TrError(`Unknow node for GTFS export ${nodeId}`, 'GTFSEXP0003');
            }
            const gtfsStop = objectToGtfs(
                nodeCollection.newObject(nodeGeojson),
                options.includeTransitionFields || false
            );
            return gtfsStop;
        });
        // Write the agencies to the gtfs file
        stopStream.write(
            unparse(gtfsStops, {
                newline: '\n',
                quotes: options.quotesFct,
                header: true
            })
        );
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', error };
    } finally {
        stopStream.end();
    }
};
