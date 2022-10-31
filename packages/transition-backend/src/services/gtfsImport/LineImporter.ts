/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Route as GtfsRouteSpec } from 'gtfs-types';
import { parseCsvFile } from 'chaire-lib-backend/lib/services/files/CsvFile';
import { gtfsFiles } from 'transition-common/lib/services/gtfs/GtfsFiles';
import Line, { LineAttributes } from 'transition-common/lib/services/line/Line';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import lineModes, { LineMode } from 'transition-common/lib/config/lineModes';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { LineImportData, GtfsImportData, GtfsRoute } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import { LineCategory } from 'transition-common/lib/config/lineCategories';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import AgencyImporter from './AgencyImporter';
import { GtfsObjectImporter } from './GtfsObjectImporter';
import { GtfsInternalData } from './GtfsImportTypes';

export class LineImporter implements GtfsObjectImporter<LineImportData, Line> {
    private _filePath: string;
    private _existingLines: LineCollection;
    private _gtfsAgencyIds: string[];

    constructor(options: { directoryPath: string; lines: LineCollection; agencyIds?: string[] }) {
        this._filePath = _isBlank(options.directoryPath)
            ? gtfsFiles.routes.name
            : `${options.directoryPath}/${gtfsFiles.routes.name}`;
        this._existingLines = options.lines;
        this._gtfsAgencyIds = options.agencyIds ? options.agencyIds : [];
    }

    /**
     * Parse the data in the GTFS route file and prepare it for presentation to
     * the user.
     *
     * @return {*}  {Promise<LineImportData[]>}
     * @memberof LineImporter
     */
    async prepareImportData(): Promise<LineImportData[]> {
        const lines: LineImportData[] = [];
        await parseCsvFile(
            this._filePath,
            (data, _rowNum) => {
                const routeData = data as GtfsRouteSpec;
                // If no agency_id, use the default agency acronym
                const { agency_id, route_type, ...rest } = routeData;
                const actualAgencyId = _isBlank(routeData.agency_id)
                    ? this._gtfsAgencyIds.length === 1
                        ? this._gtfsAgencyIds[0]
                        : AgencyImporter.DEFAULT_AGENCY_ACRONYM
                    : (agency_id as string);

                // Default behavior is to overwrite the first matching agency.
                lines.push({
                    line: {
                        agency_id: actualAgencyId,
                        route_type: parseInt((route_type as unknown) as string),
                        ...rest
                    }
                });
            },
            { header: true }
        );
        return lines;
    }

    async import(importData: GtfsImportData, internalData: GtfsInternalData): Promise<{ [key: string]: Line }> {
        const importObjects: LineImportData[] = importData.lines;
        const importedLines: { [key: string]: Line } = {};

        const lineImportPromises = importObjects
            .filter((importObject) => importObject.selected === true)
            .map(async (importObject) => {
                importedLines[importObject.line.route_id] = await this.importLine(
                    importObject,
                    {
                        agencyId: internalData.agencyIdsByAgencyGtfsId[importObject.line.agency_id]
                    },
                    internalData.doNotUpdateAgencies
                );
            });
        await Promise.allSettled(lineImportPromises);
        return importedLines;
    }

    private gtfsToObjectAttributes(gtfsObject: GtfsRoute, agencyId: string): Partial<LineAttributes> {
        let mode: LineMode | undefined = undefined;
        const categoryRouteType = Math.floor(gtfsObject.route_type / 100) * 100;
        for (let i = 0, count = lineModes.length; i < count; i++) {
            const modeGtfsId = lineModes[i].gtfsId;
            const modeExtendedGtfsId = lineModes[i].extendedGtfsId;
            if (gtfsObject.route_type === modeGtfsId || gtfsObject.route_type === modeExtendedGtfsId) {
                mode = lineModes[i].value as LineMode;
                break;
            } else if (categoryRouteType === modeExtendedGtfsId) {
                // Check if the route type without units correspond to the current mode (which would be a category), but don't stop the loop. See https://developers.google.com/transit/gtfs/reference/extended-route-types for route types
                mode = lineModes[i].value as LineMode;
            }
        }
        if (!mode) {
            throw 'Line mode cannot be set for GTFS line ' + gtfsObject.route_id;
        }

        const lineAttributes: Partial<LineAttributes> = {
            agency_id: agencyId, // should not be null!
            shortname: gtfsObject.route_short_name,
            longname: gtfsObject.route_long_name || gtfsObject.route_desc,
            mode: mode,
            data: {
                gtfs: gtfsObject
            }
        };
        if (gtfsObject.route_color) {
            lineAttributes.color = (gtfsObject.route_color.startsWith('#') ? '' : '#') + gtfsObject.route_color;
        }
        if (gtfsObject.tr_route_internal_id) {
            lineAttributes.internal_id = gtfsObject.tr_route_internal_id;
        }
        if (gtfsObject.tr_route_row_category) {
            lineAttributes.category = gtfsObject.tr_route_row_category as LineCategory;
        }
        if (gtfsObject.tr_allow_same_route_transfers) {
            lineAttributes.allow_same_line_transfers =
                gtfsObject.tr_allow_same_route_transfers === 'true' ? true : false;
        }
        if (gtfsObject.tr_is_autonomous) {
            lineAttributes.is_autonomous = gtfsObject.tr_is_autonomous === 'true' ? true : false;
        }

        return lineAttributes;
    }

    private async importLine(
        lineToImport: LineImportData,
        options: { agencyId: string },
        doNotUpdateAgencies: string[]
    ): Promise<Line> {
        // If there was an error importing the agency, this will be undefined and the line should not be imported
        if (options.agencyId === undefined) {
            throw `Agency was not imported correctly for line ${lineToImport.line.route_id}`;
        }
        const lineAttributes = this.gtfsToObjectAttributes(lineToImport.line, options.agencyId);

        // Find the line to overwrite in the agency, if any.
        // The line exists if the agency ID is the same that this line belongs to and the route was imported with the same gtfs route_id or the short and long names match
        const existingLine = this._existingLines
            .getFeatures()
            .find(
                (line) =>
                    line.getAttributes().agency_id === options.agencyId &&
                    (line.getAttributes().data?.gtfs?.route_id === lineToImport.line.route_id ||
                        (line.getAttributes().shortname === lineToImport.line.route_short_name &&
                            line.getAttributes().longname === lineToImport.line.route_long_name))
            );
        if (existingLine) {
            // Update line attributes if so requested
            if (!doNotUpdateAgencies.includes(options.agencyId)) {
                await this.updateLine(existingLine, lineAttributes);
            }
            return existingLine;
        }
        // Create a new line
        const newLine = new Line(lineAttributes, true);
        // TODO Save only at the end of the whole import, with a batch save
        await newLine.save(serviceLocator.socketEventManager);
        return newLine;
    }

    private async updateLine(line: Line, lineAttributes: Partial<LineAttributes>): Promise<Line> {
        line.startEditing();
        Object.keys(lineAttributes).forEach((attrib) => {
            // Do not update line names
            if (attrib !== 'shortname' && attrib !== 'longname') {
                line.attributes[attrib] = lineAttributes[attrib];
            }
        });
        await line.save(serviceLocator.socketEventManager);
        return line;
    }
}

export default LineImporter;
