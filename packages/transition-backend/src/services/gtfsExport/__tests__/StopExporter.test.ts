/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createWriteStream } from 'fs';
import { v4 as uuidV4 } from 'uuid';

import { exportStop } from '../StopExporter';
import Node from 'transition-common/lib/services/path/Path';

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

const nodeAttributes1 = {
    id: uuidV4(),
    name: 'Node1',
    data: {
        variables: {}
    },
    geography: { type: 'Point' as const, coordinates: [-73, 45] },
    station_id: 'abdefg',
    code: 'nodeCode',
    is_enabled: true,
    routing_radius_meters: 50,
    default_dwell_time_seconds: 20,
    is_frozen: false
};

const nodeAttributes2= {
    id: uuidV4(),
    name: 'Node2',
    geography: { type: 'Point' as const, coordinates: [-74, 46] },
    description: 'Node description, with data',
    station_id: 'abdefg',
    code: 'nodeCode2',
    is_enabled: true,
    is_frozen: false,
    color: '#112233',
    routing_radius_meters: 25,
    default_dwell_time_seconds: 60
};

const node1 = new Node(nodeAttributes1, false);
const node2 = new Node(nodeAttributes2, false);

jest.mock('../../../models/db/transitNodes.db.queries', () => {
    return {
        geojsonCollection: jest.fn().mockImplementation(async () => {
            return { type: 'FeatureCollection', features: [node1.toGeojson(), node2.toGeojson()] };
        })
    }
});

beforeEach(() => {
    mockWriteStream.write.mockClear();
    mockWriteStream.end.mockClear();
})

test('Test exporting one node', async () => {
    const response = await exportStop([nodeAttributes1.id], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('success');
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"stop_id","stop_code","stop_name","stop_desc","stop_lat","stop_lon","zone_id","stop_url","location_type","parent_station","stop_timezone","wheelchair_boarding","level_id","platform_code"',
        `"${nodeAttributes1.id}","${nodeAttributes1.code}","${nodeAttributes1.name}",,${nodeAttributes1.geography.coordinates[1]},${nodeAttributes1.geography.coordinates[0]},,,0,,,,,`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stops.txt'));
});

test('Test exporting a node with additional fields', async () => {
    const response = await exportStop([nodeAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct, includeTransitionFields: true });
    expect(response.status).toEqual('success');
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"stop_id","stop_code","stop_name","stop_desc","stop_lat","stop_lon","zone_id","stop_url","location_type","parent_station","stop_timezone","wheelchair_boarding","level_id","platform_code","tr_node_color","tr_routing_radius_meters","tr_default_dwell_time_seconds","tr_can_be_used_as_terminal"',
        `"${nodeAttributes2.id}","${nodeAttributes2.code}","${nodeAttributes2.name}","${nodeAttributes2.description}",${nodeAttributes2.geography.coordinates[1]},${nodeAttributes2.geography.coordinates[0]},,,0,,,,,,"${nodeAttributes2.color}",${nodeAttributes2.routing_radius_meters},${nodeAttributes2.default_dwell_time_seconds},`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stops.txt'));
});

test('Test exporting multiple stops', async () => {
    const response = await exportStop([nodeAttributes1.id, nodeAttributes2.id], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('success');
    expect(mockWriteStream.write).toHaveBeenCalledTimes(1);
    expect(mockWriteStream.write).toHaveBeenLastCalledWith([
        '"stop_id","stop_code","stop_name","stop_desc","stop_lat","stop_lon","zone_id","stop_url","location_type","parent_station","stop_timezone","wheelchair_boarding","level_id","platform_code"',
        `"${nodeAttributes1.id}","${nodeAttributes1.code}","${nodeAttributes1.name}",,${nodeAttributes1.geography.coordinates[1]},${nodeAttributes1.geography.coordinates[0]},,,0,,,,,`,
        `"${nodeAttributes2.id}","${nodeAttributes2.code}","${nodeAttributes2.name}","${nodeAttributes2.description}",${nodeAttributes2.geography.coordinates[1]},${nodeAttributes2.geography.coordinates[0]},,,0,,,,,`
    ].join('\n'));
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stops.txt'));
});

test('Test exporting unknown stops', async () => {
    const response = await exportStop([uuidV4()], { directoryPath: 'test', quotesFct: quoteFct });
    expect(response.status).toEqual('error');
    expect(mockWriteStream.write).not.toHaveBeenCalled();
    expect(mockWriteStream.end).toHaveBeenCalledTimes(1);
    expect(mockCreateStream).toHaveBeenCalledWith(expect.stringContaining('test/stops.txt'));
});
