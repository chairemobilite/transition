/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { listTasks } from '../listTasks';

const tasks = [
    'osrm/downloadOsmNetworkData.task.ts',
    'osrm/prepareOsmNetworkData.task.ts',
    'config/createUser.task.ts',
    'config/setup.task.ts',
    'osm/1_downloadOsmDataToFiles.task.ts',
    'osm/1b_prepareAndEnhanceOsmPolygonData.task.ts',
    'osm/2_importAndProcessOsmDataToFiles.task.ts',
    'osm/2b_assignWeightsToPOIs.task.ts',
    'osm/3_importAndValidateLandRoleData.task.ts',
];

test('Test list tasks', () => {
    expect(listTasks()).toEqual(
        expect.arrayContaining(tasks.map((task) => expect.stringContaining(task)))
    );
});
