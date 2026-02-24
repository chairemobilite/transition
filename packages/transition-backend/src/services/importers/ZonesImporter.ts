/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import xmlReader from 'xml-reader';
import fs from 'fs';
import PQueue from 'p-queue';

import zonesQueries from 'chaire-lib-backend/lib/models/db/zones.db.queries';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import { ZoneAttributes } from 'chaire-lib-common/lib/services/zones/Zone';

// Depending on the language selected when downloading the source GML file, the tag used to indicate the dissemination block ID will be different.
// We use the includes() function on this array to ensure the import works with both english and french files.
const DBUID_STRINGS = ['fme:DBUID', 'fme:IDIDU'];

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

    const queue = new PQueue({ concurrency: 3 });

    parser.on('tag:gml:featureMember', (feature: XmlNode) => {
        try {
            const fme = feature.children[0];

            // The id of the zone.
            const dbuidElement = fme.children.find((element) => DBUID_STRINGS.includes(element.name));
            if (dbuidElement === undefined) {
                throw new Error('No DBUID element found in zone feature.');
            }

            const dbuid = dbuidElement.children[0].value;

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
                // TODO: In case of errors related to too much memory usage, we should pause the stream to avoid backpressure.
                const currentBatch = [...batch];
                batch = [];
                queue.add(async () => {
                    try {
                        await zonesQueries.addZonesAndConvertedGeography(currentBatch);
                    } catch (error) {
                        console.error(`Error adding zones batch to db: ${error}`);
                        readStream.destroy(error as Error);
                    }
                });
            }

            i++;
            if (i % 100 === 0) {
                console.log(`Zones parsed: ${i}`);
            }
        } catch (error) {
            console.error(`Error while reading the gml file: ${error}`);
            readStream.destroy(error as Error);
        }
    });

    parser.on('done', () => {
        if (batch.length > 0) {
            queue.add(async () => {
                try {
                    await zonesQueries.addZonesAndConvertedGeography(batch);
                } catch (error) {
                    console.error(`Error adding final batch to db: ${error}`);
                    readStream.destroy(error as Error);
                }
            });
        }
    });

    return new Promise((resolve, reject) => {
        readStream.on('data', (chunk) => {
            parser.parse(chunk.toString());
        });

        readStream.on('error', (err) => {
            console.error(`Error while reading the stream: ${err}`);
            reject(err);
        });

        readStream.on('close', async () => {
            console.log('Adding zones to db.');
            await queue.onIdle();
            console.log(`Finished! There are ${i} new zones added to the db.`);
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
