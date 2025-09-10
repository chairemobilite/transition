/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { unparse } from 'papaparse';

import { GtfsRoute } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import Line from 'transition-common/lib/services/line/Line';
import dbQueries from '../../models/db/transitLines.db.queries';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import lineModes from 'transition-common/lib/config/lineModes';

const getGtfsRouteType = (mode: string, extended = false) => {
    for (let i = 0, count = lineModes.length; i < count; i++) {
        const lineMode = lineModes[i].value;
        const modeGtfsId = lineModes[i].gtfsId;
        const modeExtendedGtfsId = lineModes[i].extendedGtfsId;
        if (lineMode === mode) {
            return extended ? modeExtendedGtfsId : modeGtfsId;
        }
    }
    throw new TrError(`Unknow route mode ${mode}`, 'GTFSEXP0005');
};

// Utility function to clean up color hex string
const cleanHexColor = (color: string | undefined): string | undefined => {
    if (!color) return undefined;
    const hex = color.trim().replace(/^#/, '');
    // Accept only 6 hex digits per GTFS; otherwise omit the field
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
        console.warn('Trying to export invalid GTFS color %s', hex);
        return undefined;
    }
    return hex.toUpperCase();
};

const objectToGtfs = (line: Line, agencyId: string, includeCustomFields = false): GtfsRoute | undefined => {
    const attributes = line.attributes;
    const vehicleType = getGtfsRouteType(attributes.mode);
    if (vehicleType === null) {
        // Not a route to be exported to gtfs
        return undefined;
    }
    const textColor = attributes.data.gtfs?.route_text_color || line.getPreferredTextColorBasedOnLineColor();

    const gtfsFields: GtfsRoute = {
        route_id: line.getId(),
        agency_id: agencyId, // slugified acronym or uuid, required
        route_short_name: attributes.shortname, // shortname and/or longname required
        route_long_name: attributes.longname, // shortname and/or longname required
        route_desc: attributes.description, // optional
        route_type: vehicleType, // required
        route_url: attributes.data.gtfs?.route_url, // optional
        route_color: cleanHexColor(attributes.color), // optional
        route_text_color: cleanHexColor(textColor), // optional
        route_sort_order: attributes.data.gtfs?.route_sort_order, // optional
        continuous_pickup: attributes.data.gtfs?.continuous_pickup, // optional
        continuous_drop_off: attributes.data.gtfs?.continuous_drop_off // optional
    };
    if (includeCustomFields) {
        gtfsFields.tr_route_internal_id = attributes.internal_id;
        gtfsFields.tr_route_row_category = attributes.category;
        gtfsFields.tr_is_autonomous = String(attributes.is_autonomous);
        gtfsFields.tr_allow_same_route_transfers = String(attributes.allow_same_line_transfers);
    }
    return gtfsFields;
};

export const exportLine = async (
    lineIds: string[],
    options: {
        directoryPath: string;
        quotesFct: (value: unknown) => boolean;
        includeTransitionFields?: boolean;
        agencyToGtfsId: { [key: string]: string };
    }
): Promise<{ status: 'success'; serviceIds: string[] } | { status: 'error'; error: unknown }> => {
    // Prepare the file stream
    const filePath = `${options.directoryPath}/${gtfsFiles.routes.name}`;
    fileManager.truncateFileAbsolute(filePath);
    const lineStream = fs.createWriteStream(filePath);

    const lines = await dbQueries.collection();
    const lineCollection = new LineCollection([], {});
    lineCollection.loadFromCollection(lines);
    const serviceIds: { [key: string]: boolean } = {};

    try {
        const gtfsLines = lineIds.map((lineId) => {
            const line = lineCollection.getById(lineId);
            if (!line) {
                throw new TrError(`Unknow line for GTFS export ${lineId}`, 'GTFSEXP0004');
            }
            const agencyId = options.agencyToGtfsId[line.attributes.agency_id];
            const gtfsRoute = objectToGtfs(line, agencyId, options.includeTransitionFields || false);
            if (gtfsRoute !== undefined && line.attributes.service_ids !== undefined) {
                line.attributes.service_ids.forEach((serviceId: string) => (serviceIds[serviceId] = true));
            }
            return gtfsRoute;
        });
        const gtfsLinesNoUndef = gtfsLines.filter((line) => line !== undefined) as GtfsRoute[];
        // Write the agencies to the gtfs file
        lineStream.write(
            unparse(gtfsLinesNoUndef, {
                newline: '\n',
                quotes: options.quotesFct,
                header: true
            })
        );
        return { status: 'success', serviceIds: Object.keys(serviceIds) };
    } catch (error) {
        return { status: 'error', error };
    } finally {
        lineStream.end();
    }
};
