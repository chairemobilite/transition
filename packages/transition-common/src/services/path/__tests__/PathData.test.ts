/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import Path from '../Path';

const defaultLineId = uuidV4();
const node1Id = uuidV4();
const node2Id = uuidV4();

export const arbitraryData = {
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
    },
    travelTimeWithoutDwellTimesSeconds: 124,
    operatingSpeedMetersPerSecond: 23.45,
    operatingTimeWithoutLayoverTimeSeconds: 12.23
};

export const arbitraryDataWithoutTravelTimes = {
    defaultLayoverRatioOverTotalTravelTime: 0.2,
    defaultMinLayoverTimeSeconds: 120,
    defaultRoutingEngine: 'engine',
    defaultRoutingMode: 'bus',
    defaultAcceleration: 1.1,
    defaultDeceleration: 1.1,
    defaultDwellTimeSeconds: 30,
    defaultRunningSpeedKmH: 50,
    maxRunningSpeedKmH: 120,
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
    },
    operatingSpeedMetersPerSecond: 124,
    operatingTimeWithoutLayoverTimeSeconds: 12.23
};

export const getPathAttributesWithData = (withTravelTime = true, {
    lineId = defaultLineId
}) => {
    return {
        id: uuidV4(),
        name: 'PathFull',
        geography: { type: 'LineString' as const, coordinates: [[-73, 45], [-73.0001, 45]] },
        direction: 'outbound',
        line_id: lineId,
        is_enabled: true,
        /** array of node ids in this path */
        nodes: [node1Id, node2Id],
        /** TODO what's the difference with nodes? */
        stops: [node1Id, node2Id],
        /** TODO document? */
        segments: [],
        mode: 'bus',
        data: {
            ...(withTravelTime ? arbitraryData : arbitraryDataWithoutTravelTimes)
        },
        is_frozen: false
    };
}

export const getPathObjectWithData = ({
    lineId = defaultLineId,
    pathCollection
}) => {
    const attributes = getPathAttributesWithData(true, { lineId });
    const path = new Path(attributes, true);
    pathCollection.add(path);
    return path;
}

test('Dummy Path', function () {
    // Dummy test so this file passes
});