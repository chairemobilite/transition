/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createWriteStream } from 'fs';
import { v4 as uuidV4 } from 'uuid';

import { exportPath } from '../PathExporter';
import Path from 'transition-common/lib/services/path/Path';

jest.mock('fs', () => {
    // Require the original module to not be mocked...
    const originalModule =
      jest.requireActual<typeof import('fs')>('fs');

    return {
        ...originalModule,
        createWriteStream: jest.fn()
    };
});

const quoteFct = (val: unknown) => typeof val === 'string';
const mockWriteStream = {
    write: jest.fn().mockImplementation((chunk) => {

    }),
    end: jest.fn()
};
const mockCreateStream = createWriteStream as jest.MockedFunction<any>;
mockCreateStream.mockReturnValue(mockWriteStream);

const arbitraryData = {
    defaultLayoverRatioOverTotalTravelTime: 0.2,
    defaultMinLayoverTimeSeconds: 120,
    defaultRoutingEngine: 'engine',
    defaultRoutingMode: 'bus',
    defaultAcceleration: 1.1,
    defaultDeceleration: 1.1,
    defaultDwellTimeSeconds: 30,
    ignoreNodesDefaultDwellTimeSeconds: true,
    defaultRunningSpeedKmH: 50,
    maxRunningSpeedKmH: 100,
    routingMode: 'rail',
    routingEngine: 'engine',
    // The following properties contain array of data per node.
    nodeTypes: ['engine', 'engine'],
    waypoints: [],
    waypointTypes: [],
    variables: {
        d_p: null,
        n_q_p: null,
        d_l_min: null,
        d_l_max: null,
        d_l_avg: null,
        d_l_med: null,
        T_o_p: null,
        n_s_p: null,
    }
};

const pathAttributes1 = {
    id: uuidV4(),
    name: 'PathFull',
    geography: { type: 'LineString' as const, coordinates: [[-73, 45], [-73.0011, 45], [-73.003, 45.001]] },
    direction: 'outbound',
    line_id: uuidV4(),
    is_enabled: true,
    nodes: [uuidV4(), uuidV4(), uuidV4()],
    stops: [uuidV4(), uuidV4(), uuidV4()],
    segments: [],
    mode: 'bus',
    data: {
        ...arbitraryData
    },
    is_frozen: false
};

const pathAttributes2 = {
    id: uuidV4(),
    name: 'PathFull',
    geography: { type: 'LineString' as const, coordinates: [[-73.003, 45.001], [-73.0011, 45], [-73, 45]] },
    direction: 'outbound',
    line_id: pathAttributes1.id,
    is_enabled: true,
    nodes: [uuidV4(), uuidV4(), uuidV4()],
    stops: [uuidV4(), uuidV4(), uuidV4()],
    segments: [],
    mode: 'bus',
    data: {
        ...arbitraryData
    },
    is_frozen: false
};

const path1 = new Path(pathAttributes1, false);
// Convert distances in km
const path1Distances = path1.getCoordinatesDistanceTraveledMeters().map((dist) => Math.round(dist) / 1000);
const path2 = new Path(pathAttributes2, false);
const path2Distances = path2.getCoordinatesDistanceTraveledMeters().map((dist) => Math.round(dist) / 1000);

jest.mock('../../../models/db/transitPaths.db.queries', () => {
    return {
        geojsonCollection: jest.fn().mockImplementation(async () => {
            return { type: 'FeatureCollection', features: [path1.toGeojson(), path2.toGeojson()] };
        })
    };
});

beforeEach(() => {
    mockWriteStream.write.mockClear();
    mockWriteStream.end.mockClear();
});

test('Test exporting one path', async () => {
    const response = await exportPath([pathAttributes1.id], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('success');
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"shape_id","shape_pt_lat","shape_pt_lon","shape_pt_sequence","shape_dist_traveled"',
        `"${pathAttributes1.id}",${pathAttributes1.geography.coordinates[0][1]},${pathAttributes1.geography.coordinates[0][0]},0,${path1Distances[0]}`,
        `"${pathAttributes1.id}",${pathAttributes1.geography.coordinates[1][1]},${pathAttributes1.geography.coordinates[1][0]},1,${path1Distances[1]}`,
        `"${pathAttributes1.id}",${pathAttributes1.geography.coordinates[2][1]},${pathAttributes1.geography.coordinates[2][0]},2,${path1Distances[2]}`,
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/shapes.txt'));
});

test('Test exporting a path with additional fields', async () => {
    const response = await exportPath([pathAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct, includeTransitionFields: true });
    expect(response.status).toEqual('success');
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"shape_id","shape_pt_lat","shape_pt_lon","shape_pt_sequence","shape_dist_traveled","tr_shape_routing_mode","tr_shape_routing_engine"',
        `"${pathAttributes2.id}",${pathAttributes2.geography.coordinates[0][1]},${pathAttributes2.geography.coordinates[0][0]},0,${path2Distances[0]},"${pathAttributes2.data.routingMode}","${pathAttributes2.data.routingEngine}"`,
        `"${pathAttributes2.id}",${pathAttributes2.geography.coordinates[1][1]},${pathAttributes2.geography.coordinates[1][0]},1,${path2Distances[1]},"${pathAttributes2.data.routingMode}","${pathAttributes2.data.routingEngine}"`,
        `"${pathAttributes2.id}",${pathAttributes2.geography.coordinates[2][1]},${pathAttributes2.geography.coordinates[2][0]},2,${path2Distances[2]},"${pathAttributes2.data.routingMode}","${pathAttributes2.data.routingEngine}"`,
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/shapes.txt'));
});

test('Test exporting multiple paths', async () => {
    const response = await exportPath([pathAttributes1.id, pathAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('success');
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"shape_id","shape_pt_lat","shape_pt_lon","shape_pt_sequence","shape_dist_traveled"',
        `"${pathAttributes1.id}",${pathAttributes1.geography.coordinates[0][1]},${pathAttributes1.geography.coordinates[0][0]},0,${path1Distances[0]}`,
        `"${pathAttributes1.id}",${pathAttributes1.geography.coordinates[1][1]},${pathAttributes1.geography.coordinates[1][0]},1,${path1Distances[1]}`,
        `"${pathAttributes1.id}",${pathAttributes1.geography.coordinates[2][1]},${pathAttributes1.geography.coordinates[2][0]},2,${path1Distances[2]}`,
        `"${pathAttributes2.id}",${pathAttributes2.geography.coordinates[0][1]},${pathAttributes2.geography.coordinates[0][0]},0,${path2Distances[0]}`,
        `"${pathAttributes2.id}",${pathAttributes2.geography.coordinates[1][1]},${pathAttributes2.geography.coordinates[1][0]},1,${path2Distances[1]}`,
        `"${pathAttributes2.id}",${pathAttributes2.geography.coordinates[2][1]},${pathAttributes2.geography.coordinates[2][0]},2,${path2Distances[2]}`,
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/shapes.txt'));
});

test('Test exporting unknown paths', async () => {
    const response = await exportPath([uuidV4()], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('error');
    expect(mockWriteStream.write).not.toHaveBeenCalled();
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/shapes.txt'));
});
