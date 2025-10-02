/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { getStreetsAroundPoint } from '../OsmGetStreetsAroundPoint';
import OsmDownloader from 'chaire-lib-backend/lib/utils/osm/OsmOverpassDownloader';
import * as Status from 'chaire-lib-common/lib/utils/Status';

jest.mock('chaire-lib-backend/lib/utils/osm/OsmOverpassDownloader', () => {
    return { downloadGeojson: jest.fn() };
});

describe('getStreetsAroundPoint', () => {
    const mockedDownloadGeojson = OsmDownloader.downloadGeojson as jest.MockedFunction<typeof OsmDownloader.downloadGeojson>;
    it('should return mocked streets around a given point', async () => {
        mockedDownloadGeojson.mockResolvedValueOnce({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { name: 'Mock Street 1' },
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [-73.935242, 40.73061],
                            [-73.935242, 40.73161],
                        ],
                    },
                }
            ]
        } as GeoJSON.FeatureCollection<GeoJSON.LineString>);
        const aroundPoint: GeoJSON.Feature<GeoJSON.Point> = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Point',
                coordinates: [-73.935242, 40.73061],
            }
        };
        const status = await getStreetsAroundPoint(aroundPoint, 100) as Status.StatusResult<GeoJSON.Feature[]>;
        expect(status.status).toBe('ok');
        expect(status.result).toHaveLength(1);
        expect(status.result[0].properties?.name).toBe('Mock Street 1');
    });

    it('should return empty streets around a given point if none found', async () => {
        mockedDownloadGeojson.mockResolvedValueOnce({
            type: 'FeatureCollection',
            features: []
        } as GeoJSON.FeatureCollection<GeoJSON.LineString>);
        const aroundPoint: GeoJSON.Feature<GeoJSON.Point> = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Point',
                coordinates: [-73.935242, 40.73061],
            }
        };
        const status = await getStreetsAroundPoint(aroundPoint, 100) as Status.StatusResult<GeoJSON.Feature[]>;
        expect(status.status).toBe('ok');
        expect(status.result).toHaveLength(0);
    });

    it ('should return an error if download geojson fails', async () => {
        mockedDownloadGeojson.mockRejectedValueOnce('Download geojson failed');
        const aroundPoint: GeoJSON.Feature<GeoJSON.Point> = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Point',
                coordinates: [-73.935242, 40.73061],
            }
        };
        const status = await getStreetsAroundPoint(aroundPoint, 100);
        expect(Status.isStatusError(status));
    });

    it ('should return an error when radius is 0 or less', async () => {
        const aroundPoint: GeoJSON.Feature<GeoJSON.Point> = {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'Point',
                coordinates: [-73.935242, 40.73061],
            }
        };
        const status1 = await getStreetsAroundPoint(aroundPoint, -100);
        expect(Status.isStatusError(status1));
        expect((status1 as Status.StatusError).error).toBe('Radius must be greater than 0');
        const status2 = await getStreetsAroundPoint(aroundPoint,0);
        expect(Status.isStatusError(status2));
        expect((status2 as Status.StatusError).error).toBe('Radius must be greater than 0');
    });
});
