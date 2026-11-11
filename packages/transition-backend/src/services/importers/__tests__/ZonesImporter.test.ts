/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import importBoundariesFromGml, { addCommasToPosList } from '../ZonesImporter';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import zonesQueries from 'chaire-lib-backend/lib/models/db/zones.db.queries';

jest.mock('chaire-lib-backend/lib/utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn().mockReturnValue(true),
    }
}));
const fileExistsMock = fileManager.fileExistsAbsolute as jest.MockedFunction<typeof fileManager.fileExistsAbsolute>;

jest.mock('chaire-lib-backend/lib/models/db/zones.db.queries', () => ({
    addZonesAndConvertedGeography: jest.fn().mockResolvedValue(undefined)
}));
const addZonesMock = zonesQueries.addZonesAndConvertedGeography as jest.MockedFunction<typeof zonesQueries.addZonesAndConvertedGeography>;

// A zone with a single surface with a hole, in an english file
const surfaceFeature = `
    <gml:featureMember>
        <fme:ldb_000a21g_e gml:id="id1">
            <fme:DBUID>10010001001</fme:DBUID>
            <fme:DBRPLAMX>8992543.22</fme:DBRPLAMX>
            <gml:surfaceProperty>
                <gml:Surface srsName="EPSG:3347" srsDimension="2">
                    <gml:patches>
                        <gml:PolygonPatch>
                            <gml:exterior>
                                <gml:LinearRing>
                                    <gml:posList>0 0 10 0 10 10 0 0</gml:posList>
                                </gml:LinearRing>
                            </gml:exterior>
                            <gml:interior>
                                <gml:LinearRing>
                                    <gml:posList>2 2 4 2 4 4 2 2</gml:posList>
                                </gml:LinearRing>
                            </gml:interior>
                        </gml:PolygonPatch>
                    </gml:patches>
                </gml:Surface>
            </gml:surfaceProperty>
        </fme:ldb_000a21g_e>
    </gml:featureMember>`;

// A zone with two surfaces, in a french file, where one surface has an invalid ring that is ignored
const multiSurfaceFeature = `
    <gml:featureMember>
        <fme:ldb_000a21g_f gml:id="id2">
            <fme:IDIDU>10010001002</fme:IDIDU>
            <gml:multiSurfaceProperty>
                <gml:MultiSurface srsName="EPSG:3347" srsDimension="2">
                    <gml:surfaceMember>
                        <gml:Surface>
                            <gml:patches>
                                <gml:PolygonPatch>
                                    <gml:exterior>
                                        <gml:LinearRing>
                                            <gml:posList>20 20 30 20 30 30 20 20</gml:posList>
                                        </gml:LinearRing>
                                    </gml:exterior>
                                </gml:PolygonPatch>
                            </gml:patches>
                        </gml:Surface>
                    </gml:surfaceMember>
                    <gml:surfaceMember>
                        <gml:Surface>
                            <gml:patches>
                                <gml:PolygonPatch>
                                    <gml:exterior>
                                        <gml:Ring>
                                            <gml:curveMember>40 40</gml:curveMember>
                                        </gml:Ring>
                                    </gml:exterior>
                                    <gml:interior>
                                        <gml:LinearRing>
                                            <gml:posList>50 50 60 50 60 60 50 50</gml:posList>
                                        </gml:LinearRing>
                                    </gml:interior>
                                </gml:PolygonPatch>
                            </gml:patches>
                        </gml:Surface>
                    </gml:surfaceMember>
                </gml:MultiSurface>
            </gml:multiSurfaceProperty>
        </fme:ldb_000a21g_f>
    </gml:featureMember>`;

// A zone without any valid ring, which is not imported
const invalidFeature = `
    <gml:featureMember>
        <fme:ldb_000a21g_e gml:id="id3">
            <fme:DBUID>10010001003</fme:DBUID>
            <gml:surfaceProperty>
                <gml:Surface srsName="EPSG:3347" srsDimension="2">
                    <gml:patches>
                        <gml:PolygonPatch>
                            <gml:exterior>
                                <gml:Ring>
                                    <gml:curveMember>70 70</gml:curveMember>
                                </gml:Ring>
                            </gml:exterior>
                        </gml:PolygonPatch>
                    </gml:patches>
                </gml:Surface>
            </gml:surfaceProperty>
        </fme:ldb_000a21g_e>
    </gml:featureMember>`;

const gmlFile = (features: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<gml:FeatureCollection xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:fme="http://www.safe.com/gml/fme">
    <gml:boundedBy>
        <gml:Envelope srsName="EPSG:3347" srsDimension="2">
            <gml:lowerCorner>0 0</gml:lowerCorner>
            <gml:upperCorner>60 60</gml:upperCorner>
        </gml:Envelope>
    </gml:boundedBy>${features.join('')}
</gml:FeatureCollection>
`;

describe('importBoundariesFromGml', () => {
    let tmpDir: string;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zonesImporter-'));
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const writeGmlFile = (content: string) => {
        const filename = path.join(tmpDir, 'boundaries.gml');
        fs.writeFileSync(filename, content);
        return filename;
    };

    test('should throw an error if GML file does not exist', async () => {
        fileExistsMock.mockReturnValueOnce(false);
        const filename = '/absolute/path/to/filename.gml';
        await expect(importBoundariesFromGml(filename, 'data source')).rejects.toThrow(`Boundaries GML file not found: ${filename}`);
        expect(fileExistsMock).toHaveBeenCalledWith(filename);
    });

    test('should import the zones with their geography', async () => {
        const filename = writeGmlFile(gmlFile([surfaceFeature, multiSurfaceFeature, invalidFeature]));

        await importBoundariesFromGml(filename, 'dataSourceId');

        expect(addZonesMock).toHaveBeenCalledTimes(1);
        expect(addZonesMock).toHaveBeenCalledWith([
            {
                zone: { id: expect.any(String), internal_id: '10010001001', dataSourceId: 'dataSourceId', data: {} },
                spatialReferenceId: '3347',
                geography: 'MULTIPOLYGON(((0 0,10 0,10 10,0 0)),((2 2,4 2,4 4,2 2)))'
            },
            {
                zone: { id: expect.any(String), internal_id: '10010001002', dataSourceId: 'dataSourceId', data: {} },
                spatialReferenceId: '3347',
                geography: 'MULTIPOLYGON(((20 20,30 20,30 30,20 20)),((50 50,60 50,60 60,50 50)))'
            }
        ]);
    });

    test('should import the zones in batches of 500', async () => {
        const filename = writeGmlFile(gmlFile(Array(501).fill(surfaceFeature)));

        await importBoundariesFromGml(filename, 'dataSourceId');

        expect(addZonesMock).toHaveBeenCalledTimes(2);
        expect(addZonesMock.mock.calls[0][0]).toHaveLength(500);
        expect(addZonesMock.mock.calls[1][0]).toHaveLength(1);
    });

    test('should reject if the GML file is not valid XML', async () => {
        const filename = writeGmlFile(gmlFile([surfaceFeature]).replace('</gml:FeatureCollection>', ''));

        await expect(importBoundariesFromGml(filename, 'dataSourceId')).rejects.toThrow('Unclosed root tag');
    });
});

describe('addCommasToPosList', () => {

    test('should return the string of coordinates in the right format', async () => {
        const coordinateWithoutCommas = '1 2 3 4 5 6 7 8 9 10';
        const coordinateWithCommas = '1 2,3 4,5 6,7 8,9 10';
        expect(addCommasToPosList(coordinateWithoutCommas)).toBe(coordinateWithCommas);
    });
});