/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _omit from 'lodash/omit';
import _cloneDeep from 'lodash/cloneDeep';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';

import Line from '../Line';
import { duplicateLine } from '../LineDuplicator';
import LineCollection from '../LineCollection';
import ServiceCollection from '../../service/ServiceCollection';
import Service from '../../service/Service';
import PathCollection from '../../path/PathCollection';
import Path from '../../path/Path';
import { lineAttributesBaseData } from './LineData';
import { getPathObjectWithData } from '../../path/__tests__/PathData';
import { getScheduleAttributes } from '../../schedules/__tests__/ScheduleData';
import Schedule from '../../schedules/Schedule';
import { duplicateSchedules } from '../../schedules/ScheduleDuplicator';

const lineSaveFct = Line.prototype.save = jest.fn();
const lineRefreshSchedulesFct =Line.prototype.refreshSchedules = jest.fn();
const pathSaveFct = Path.prototype.save = jest.fn();
const serviceSaveFct = Service.prototype.save = jest.fn();
const eventManager = EventManagerMock.eventManagerMock;

let lineCollection: LineCollection;
let pathCollection: PathCollection;
let serviceCollection: ServiceCollection;
let collectionManager: CollectionManager;

jest.mock('../../schedules/ScheduleDuplicator', () => ({
    duplicateSchedules: jest.fn()
}));
const duplicateSchedulesMock = duplicateSchedules as jest.MockedFunction<typeof duplicateSchedules>;

beforeEach(() => {
    lineCollection = new LineCollection([], {});
    pathCollection = new PathCollection([], {});
    serviceCollection = new ServiceCollection([], {});
    collectionManager = new CollectionManager(eventManager, {
        lines: lineCollection,
        services: serviceCollection,
        paths: pathCollection
    });
    jest.clearAllMocks();
    EventManagerMock.mockClear();
});

test('duplicate simple line, no paths, no schedules', async () => {

    // Add a line that is not new
    const lineAttributes = _cloneDeep(lineAttributesBaseData);
    const baseLine = new Line(lineAttributes, false, collectionManager);
    lineCollection.add(baseLine);

    // Copy the line a first time
    const copy1 = await duplicateLine(baseLine, { socket: eventManager });

    expect(copy1.attributes.id).not.toEqual(baseLine.attributes.id);
    let actual = _omit(copy1.attributes, 'id');
    let expected = _omit(lineAttributes, 'id');
    expect(actual).toEqual(expected);
    expect(lineSaveFct).toHaveBeenCalledTimes(1);
    expect(lineCollection.size()).toEqual(2);
    
    // Make a second copy, but change the agencyId, shortname and longname
    const newLongname = 'new line name';
    const newShortname = 'nsn';
    const agencyId = uuidV4();
    const copy2 = await duplicateLine(baseLine, { socket: eventManager, agencyId, newShortname, newLongname });

    expect(copy2.attributes.id).not.toEqual(baseLine.attributes.id);
    expect(copy2.attributes.id).not.toEqual(copy1.attributes.id);
    expected = Object.assign(expected, { agency_id: agencyId, longname: newLongname, shortname: newShortname });
    actual = _omit(copy2.attributes, 'id');
    expect(actual).toEqual(expected);
    expect(lineSaveFct).toHaveBeenCalledTimes(2);
    expect(lineCollection.size()).toEqual(3);

});

test('duplicate line with path', async () => {
    const lineAttributes = _cloneDeep(lineAttributesBaseData);
    const path = getPathObjectWithData({ lineId: lineAttributes.id, pathCollection: collectionManager.get('paths') });
    lineAttributes.path_ids = [path.getId()];

    const baseLine = new Line(lineAttributes, false, collectionManager);
    lineCollection.add(baseLine);

    // Copy the line and make sure the path was correctly copied
    const copy1 = await duplicateLine(baseLine, { socket: eventManager });

    const newPaths = copy1.paths;
    expect(newPaths.length).toEqual(1);
    const newPath = newPaths[0];
    expect(newPath.getId()).not.toEqual(path.getId());

    const expectedPath = _omit(path.attributes, 'id');
    const actualPath = _omit(newPath.attributes, 'id');
    expectedPath.line_id = copy1.getId();
    expect(actualPath).toEqual(expectedPath);

    expect(pathSaveFct).toHaveBeenCalledTimes(1);
    expect(pathCollection.size()).toEqual(2);

});

describe('duplicate line with path and schedules', () => {

    let baseLine: Line;
    let schedule: Schedule;
    let service: Service;

    beforeEach(() => {
        // Create a path
        const lineAttributes = _cloneDeep(lineAttributesBaseData);
        const path = getPathObjectWithData({ lineId: lineAttributes.id, pathCollection });
        lineAttributes.path_ids = [path.getId()];

        // Create a service and assign a schedule
        service = new Service({}, true);
        serviceCollection.add(service);
        const scheduleAttributes = getScheduleAttributes({ lineId: lineAttributes.id, serviceId: service.getId(), pathId: path.getId() });
        schedule = new Schedule(scheduleAttributes, true);
        lineAttributes.scheduleByServiceId[service.getId()] = schedule.attributes;

        // Create a line object with path and schedule
        baseLine = new Line(lineAttributes, false, collectionManager);
        lineCollection.add(baseLine);
    })

    test('duplicate line without the schedules', async () => {
        // Copy the line and make sure the path was correctly copied
        const copy = await duplicateLine(baseLine, { socket: eventManager, duplicateServices: false, duplicateSchedules: false });

        // Make sure there are no schedules and no service has been duplicated
        expect(serviceCollection.size()).toEqual(1);
        expect(copy.getSchedules()).toEqual({});
        expect(duplicateSchedulesMock).not.toHaveBeenCalled();
        expect(lineRefreshSchedulesFct).not.toHaveBeenCalled();
    });

    test('duplicate line with the schedules, but on the same service', async () => {
        // Copy the line and make sure the path was correctly copied
        const copy = await duplicateLine(baseLine, { socket: eventManager, duplicateServices: false, duplicateSchedules: true });

        // Validate schedules duplication call has been correctly done
        expect(duplicateSchedulesMock).toHaveBeenCalledTimes(1);
        expect(lineRefreshSchedulesFct).toHaveBeenCalledTimes(1);
        expect(duplicateSchedulesMock).toHaveBeenCalledWith(eventManager,{
            lineIdMapping: { [baseLine.getId()]: copy.getId() },
            serviceIdMapping: { },
            pathIdMapping: { [baseLine.paths[0].getId()]: copy.paths[0].getId() }
        });

        // Make sure no service has been duplicated
        expect(serviceSaveFct).not.toHaveBeenCalled();
        expect(serviceCollection.size()).toEqual(1);
        
    });

    test('duplicate line with the schedules, duplicating service too', async () => {
        // Copy the line and make sure the path was correctly copied
        const copy = await duplicateLine(baseLine, { socket: eventManager, duplicateServices: true, duplicateSchedules: true });

        // Make sure the service has been duplicated and find its new ID
        expect(serviceSaveFct).toHaveBeenCalledTimes(1);
        expect(serviceCollection.size()).toEqual(2);
        const newServiceId = serviceCollection.getFeatures().filter(feature => feature.getId() !== service.getId())[0].getId();

        // Validate schedules duplication call has been correctly done
        expect(duplicateSchedulesMock).toHaveBeenCalledTimes(1);
        expect(lineRefreshSchedulesFct).toHaveBeenCalledTimes(1);
        expect(duplicateSchedulesMock).toHaveBeenCalledWith(eventManager,{
            lineIdMapping: { [baseLine.getId()]: copy.getId() },
            serviceIdMapping: { [service.getId()]: newServiceId },
            pathIdMapping: { [baseLine.paths[0].getId()]: copy.paths[0].getId() }
        });
    });

    test('duplicate line with the schedules, with service mapping', async () => {
        // Create new service and add a mapping to duplication
        const otherService = new Service({}, true);
        serviceCollection.add(otherService);
        const serviceIdsMapping = {};
        serviceIdsMapping[service.getId()] = otherService.getId();

        // Copy the line and make sure the path was correctly copied
        const copy = await duplicateLine(baseLine, { socket: eventManager, duplicateServices: true, duplicateSchedules: true, serviceIdsMapping });

        // Make sure there are schedules but no service has been duplicated
        expect(serviceSaveFct).toHaveBeenCalledTimes(0);
        expect(serviceCollection.size()).toEqual(2);

        // Validate schedules duplication call has been correctly done
        expect(duplicateSchedulesMock).toHaveBeenCalledTimes(1);
        expect(lineRefreshSchedulesFct).toHaveBeenCalledTimes(1);
        expect(duplicateSchedulesMock).toHaveBeenCalledWith(eventManager,{
            lineIdMapping: { [baseLine.getId()]: copy.getId() },
            serviceIdMapping: { [service.getId()]: otherService.getId() },
            pathIdMapping: { [baseLine.paths[0].getId()]: copy.paths[0].getId() }
        });
    });

    test('duplicate line with the schedules, but line has no schedules', async () => {
        // Remove schedules from the line
        baseLine.attributes.scheduleByServiceId = {};
        // Copy the line and make sure the path was correctly copied
        const copy = await duplicateLine(baseLine, { socket: eventManager, duplicateServices: false, duplicateSchedules: true });

        // Validate schedules duplication call has been correctly done
        expect(duplicateSchedulesMock).toHaveBeenCalledTimes(1);
        expect(lineRefreshSchedulesFct).toHaveBeenCalledTimes(1);
        expect(duplicateSchedulesMock).toHaveBeenCalledWith(eventManager,{
            lineIdMapping: { [baseLine.getId()]: copy.getId() },
            serviceIdMapping: { },
            pathIdMapping: { [baseLine.paths[0].getId()]: copy.paths[0].getId() }
        });

        // Make sure no service has been duplicated
        expect(serviceSaveFct).not.toHaveBeenCalled();
        expect(serviceCollection.size()).toEqual(1);
    });
});

test('duplicate agency with lines, services and schedules', async() => {
    // TODO Add test with lines, services and schedules once all those classes are in typescript
});