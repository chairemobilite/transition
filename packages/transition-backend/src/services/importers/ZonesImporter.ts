/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import xmlReader from 'xml-reader';
import fs from 'fs';

import zonesQueries from 'chaire-lib-backend/lib/models/db/zones.db.queries';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { ZoneAttributes } from 'chaire-lib-common/lib/services/zones/Zone';

// The structure of the object given by the xml-reader package. Copied from the npm page.
interface XmlNode {
    /** element name (empty for text nodes) */
    name: string;
    /** node type (element or text), see NodeType constants */
    type: string;
    /** value of a text node */
    value: string;
    /** reference to parent node (null with parentNodes option disabled or root node) */
    parent: XmlNode;
    /** map of attributes name => value */
    attributes: { [name: string]: string };
    /** array of children nodes */
    children: XmlNode[];
}

// Import zone boundaries in the tr_zone tables using gml files from Statistics Canada.
export default async function importBoundariesFromGml(boundariesFile: string, dataSourceId: string): Promise<void> {
    if (!fileManager.fileExistsAbsolute(boundariesFile)) {
        throw new Error(`Boundaries GML file not found: ${boundariesFile}`);
    }

    const parser = xmlReader.create({ stream: true, parentNodes: false });
    const readStream = fs.createReadStream(boundariesFile);
    let i = 0;

    const batchSize = 500;
    let batch: {
        zone: Omit<ZoneAttributes, 'geography'>;
        spatialReferenceId: string;
        geography: string;
    }[] = [];

    console.log('Parsing through GML FILE:');

    parser.on('tag:gml:featureMember', (feature: XmlNode) => {
        try {
            const fme = feature.children[0];

            // The id of the zone.
            const dbuid = (fme.children.find((element) => element.name === 'fme:DBUID') as XmlNode).children[0].value;

            const multiCoorList: string[] = [];

            // The spatial reference id of the coordinate system used. Necessary to later convert into the coordinates used by Transition.
            let spatialReferenceId: string = '';

            // The GML file uses two types of geometry for the zones: simple surfaces and multi surfaces, with slightly different structures that need their own parsing logic
            // Most of them are simple surfaces, with multi surfaces having multiple non connected polygons, such as zones that includes islands
            const surfaceProperty = fme.children.find((element) => element.name === 'gml:surfaceProperty');
            if (surfaceProperty !== undefined) {
                const surface = surfaceProperty.children[0];
                const srsName = surface.attributes.srsName;
                spatialReferenceId = srsName.split('EPSG:')[1];
                const polygonPatch = surface.children[0].children[0];
                // Multiple children means a zone has one or more hole in the middle, containing a smaller zone.
                for (const singlePolygon of polygonPatch.children) {
                    const ring = singlePolygon.children[0];
                    const ringType = ring.name;
                    // A few zones are incorrectly written in the file, with nonsense geometry like single dots. The right zones are all linear rings.
                    if (ringType === 'gml:LinearRing') {
                        const posList = ring.children[0].children[0].value;
                        multiCoorList.push(`((${addCommasToPosList(posList)}))`);
                    }
                }
            }

            const multiSurfaceProperty = fme.children.find((element) => element.name === 'gml:multiSurfaceProperty');
            if (multiSurfaceProperty !== undefined) {
                const multiSurface = multiSurfaceProperty.children[0];
                const srsName = multiSurface.attributes.srsName;
                spatialReferenceId = srsName.split('EPSG:')[1];
                const surfaceMembers = multiSurface.children;
                for (const surfaceMember of surfaceMembers) {
                    const polygonPatch = surfaceMember.children[0].children[0].children[0];
                    for (const singlePolygon of polygonPatch.children) {
                        const ring = singlePolygon.children[0];
                        const ringType = ring.name;
                        if (ringType === 'gml:LinearRing') {
                            const posList = ring.children[0].children[0].value;
                            multiCoorList.push(`((${addCommasToPosList(posList)}))`);
                        }
                    }
                }
            }

            if (multiCoorList.length >= 1) {
                const zoneData = {
                    id: uuidV4(),
                    internal_id: dbuid,
                    dataSourceId,
                    data: {}
                };
                batch.push({
                    zone: zoneData,
                    spatialReferenceId,
                    geography: `MULTIPOLYGON(${multiCoorList.join()})`
                });
            }

            if (batch.length >= batchSize) {
                readStream.pause();
                zonesQueries.addZonesAndConvertedGeography(batch);
                readStream.resume();
                batch = [];
            }

            i++;
            if (i % 100 === 0) {
                console.log(`Zones parsed and added to DB: ${i}`);
            }
        } catch (error) {
            console.log(`Error while reading the gml file: ${error}`);
            readStream.destroy();
        }
    });

    parser.on('done', async () => {
        if (batch.length > 0) {
            readStream.pause();
            await zonesQueries.addZonesAndConvertedGeography(batch);
            readStream.resume();
        }
        console.log(`Finished! There are ${i} new zones.`);
    });

    return new Promise((resolve, reject) => {
        readStream.on('data', (chunk) => {
            parser.parse(chunk.toString());
        });

        readStream.on('error', (err) => {
            console.log(`Error while reading the stream: ${err}`);
            reject();
        });

        readStream.on('close', () => {
            resolve();
        });
    });
}

export function addCommasToPosList(posList: string): string {
    const individualCoordinates = posList.split(' ');
    const result: string[] = [];

    for (let i = 0; i < individualCoordinates.length; i++) {
        let coor = individualCoordinates[i];

        // We want to add a comma after every second number to separate the coordinates (but not the last one)
        if (i < individualCoordinates.length - 1) {
            coor += i % 2 === 0 ? ' ' : ',';
        }

        result.push(coor);
    }

    return result.join('');
}
