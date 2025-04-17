/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { v4 as uuidV4 } from 'uuid';
import _omit from 'lodash/omit';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import lineModes from '../../../config/lineModes';
import * as Status from 'chaire-lib-common/lib/utils/Status';

import Line from '../Line';
import { lineAttributesBaseData, lineAttributesMinimalData, lineAttributesWithPathAndSchedule } from './LineData.test';
import { EventEmitter } from 'events';
import Schedule from '../../schedules/Schedule';

const eventManager = EventManagerMock.eventManagerMock;

const linePreferences = {
    transit: {
        lines: {
            defaultMode: 'trolleybus',
            defaultCategory: 'B',
            defaultIsAutonomous: false,
            defaultAllowSameLineTransfers: true
        }
    }
};

const lineModePreferences = {
    transit: {
        lines: {
            lineModesDefaultValues: {
                bus: {
                    defaultDwellTimeSeconds: 24
                }
            }
        }
    }
};

Preferences.setAttributes(Object.assign({}, Preferences.attributes, linePreferences));

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('New lines', () => {

    const line = new Line(lineAttributesBaseData, true);
    expect(line.attributes).toEqual(lineAttributesBaseData);
    expect(line.isNew()).toBe(true);

});

test('New line default data', () => {
    const line = new Line(lineAttributesMinimalData, true);
    expect(line.attributes).toEqual({
        ...lineAttributesMinimalData,
        scheduleByServiceId: {},
        path_ids: [],
        mode: linePreferences.transit.lines.defaultMode,
        category: linePreferences.transit.lines.defaultCategory,
        allow_same_line_transfers: linePreferences.transit.lines.defaultAllowSameLineTransfers,
        is_autonomous: linePreferences.transit.lines.defaultIsAutonomous,
        data: {},
    });
    expect(line.isNew()).toBe(true);

});

test('should validate', () => {
    const line1 = new Line(lineAttributesBaseData, true);
    expect(line1.validate()).toBe(true);

    const line2 = new Line(lineAttributesMinimalData, true);
    expect(line2.validate()).toBe(false);

});

test('should convert to string', () => {
    const path1a = new Line(lineAttributesBaseData, true);
    expect(path1a.toString()).toBe(`${lineAttributesBaseData.shortname} ${lineAttributesBaseData.longname}`);
    expect(path1a.toString(true)).toBe(`${lineAttributesBaseData.shortname} ${lineAttributesBaseData.longname} ${lineAttributesBaseData.id}`);
    path1a.set('longname', undefined);
    expect(path1a.toString()).toBe(`${lineAttributesBaseData.shortname}`);
    expect(path1a.toString(true)).toBe(`${lineAttributesBaseData.shortname} ${lineAttributesBaseData.id}`);
    path1a.set('shortname', undefined);
    expect(path1a.toString()).toBe('');
    expect(path1a.toString(true)).toBe(`${lineAttributesBaseData.id}`);

});

test('should save and delete in memory', () => {
    const line = new Line(lineAttributesBaseData, true);
    expect(line.isNew()).toBe(true);
    expect(line.isDeleted()).toBe(false);
    line.saveInMemory();
    expect(line.isNew()).toBe(false);
    line.deleteInMemory();
    expect(line.isDeleted()).toBe(true);
});

test('Save line', async () => {
    const line = new Line(lineAttributesBaseData, true);
    line.startEditing();
    await line.save(eventManager as any);
    expect(eventManager.emit).toHaveBeenCalledTimes(1);
    expect(eventManager.emit).toHaveBeenCalledWith('transitLine.create', line.attributes, expect.anything());

    // Update
    line.set('mode', 'train');
    await line.save(eventManager as any);
    expect(eventManager.emit).toHaveBeenCalledTimes(2);
    expect(eventManager.emit).toHaveBeenCalledWith('transitLine.update', line.getId(), line.attributes, expect.anything());
});

test('Delete line', async () => {
    EventManagerMock.emitResponseReturnOnce(Status.createOk({ id: lineAttributesBaseData.id }));
    const line = new Line(lineAttributesBaseData, false);
    await line.delete(eventManager as any);
    expect(eventManager.emit).toHaveBeenCalledTimes(1);
    expect(eventManager.emit).toHaveBeenCalledWith('transitLine.delete', line.getId(), undefined, expect.anything());
    expect(line.isDeleted()).toBe(true);
});

test('static methods should work', () => {
    expect(Line.getPluralName()).toBe('lines');
    expect(Line.getCapitalizedPluralName()).toBe('Lines');
    expect(Line.getDisplayName()).toBe('Line');
    const path = new Line(lineAttributesBaseData, true);
    expect(path.getPluralName()).toBe('lines');
    expect(path.getCapitalizedPluralName()).toBe('Lines');
    expect(path.getDisplayName()).toBe('Line');
});

test('getClonedAttributes', () => {
    const line = new Line(lineAttributesWithPathAndSchedule, true);

    // Delete specifics
    const clonedAttributes = line.getClonedAttributes();
    const { id, created_at, updated_at, path_ids, data, ...expected } = _cloneDeep(lineAttributesWithPathAndSchedule);
    (expected as any).path_ids = [];
    (expected as any).data = _omit(data, 'gtfs');
    expect(clonedAttributes).toEqual(expected);

    // Complete copy
    const clonedAttributes2 = line.getClonedAttributes(false);
    const { data: data2, ...expectedWithSpecifics } = _cloneDeep(lineAttributesWithPathAndSchedule);
    (expectedWithSpecifics as any).data = _omit(data, 'gtfs');
    expect(clonedAttributes2).toEqual(expectedWithSpecifics);
});

test('newPath', () => {
    const line = new Line(lineAttributesBaseData, true);
    const newPath = line.newPath();
    expect(newPath.attributes.id).toBeDefined();
    expect(newPath.attributes.mode).toEqual(line.attributes.mode);
    expect(newPath.attributes.color).toEqual(line.attributes.color);
    expect(newPath.attributes.data).toEqual(expect.objectContaining(lineModes[0].defaultValues.data));

    const pathInitialData = { direction: 'inbound' as const, name: 'test', color: '#112233' };
    const newPathWithData = line.newPath(pathInitialData);
    expect(newPathWithData.attributes.id).toBeDefined();
    expect(newPathWithData.attributes.mode).toEqual(line.attributes.mode);
    expect(newPathWithData.attributes.data).toEqual(expect.objectContaining(lineModes[0].defaultValues.data));
    expect(newPathWithData.attributes).toEqual(expect.objectContaining(pathInitialData));
});

test('newPath with custom line mode default values', () => {
    Preferences.setAttributes(Object.assign({}, Preferences.attributes, lineModePreferences));
    const line = new Line(lineAttributesBaseData, true);
    const newPath = line.newPath();
    expect(newPath.attributes.data.defaultDwellTimeSeconds).toEqual(24);
});

describe('Test schedules management', () => {

    const socket = new EventEmitter();
    const schedulesAttributes = [
        {
            id: uuidV4(),
            line_id: lineAttributesWithPathAndSchedule.id,
            service_id: uuidV4(),
            periods: [],
            data: {}
        },
        {
            id: uuidV4(),
            line_id: lineAttributesWithPathAndSchedule.id,
            service_id: uuidV4(),
            periods: [],
            data: {}
        }
    ];

    test('Refreshing schedules with new schedules', async () => {
        const lineAttributesForScheduleTest = _cloneDeep(lineAttributesWithPathAndSchedule);
        const line = new Line(lineAttributesForScheduleTest, false);
        expect(line.getSchedules()).toEqual({});
        socket.on('transitSchedules.getForLine', (_lineId, callback) => callback(Status.createOk(schedulesAttributes)));
        await line.refreshSchedules(socket);
        expect(line.getSchedules()).toEqual({
            [schedulesAttributes[0].service_id]: new Schedule(schedulesAttributes[0], false),
            [schedulesAttributes[1].service_id]: new Schedule(schedulesAttributes[1], false)
        });
    });

    test('Refreshing schedules with schedules already present', async () => {
        const lineAttributesForScheduleTest = _cloneDeep(lineAttributesWithPathAndSchedule);
        lineAttributesForScheduleTest.scheduleByServiceId = {
            [schedulesAttributes[0].service_id]: schedulesAttributes[0],
            [schedulesAttributes[1].service_id]: schedulesAttributes[1]
        };
        const line = new Line(lineAttributesForScheduleTest, false);
        expect(line.getSchedules()).toEqual({
            [schedulesAttributes[0].service_id]: new Schedule(schedulesAttributes[0], false),
            [schedulesAttributes[1].service_id]: new Schedule(schedulesAttributes[1], false)
        });
        socket.on('transitSchedules.getForLine', (_lineId, callback) => callback(Status.createOk([])));
        await line.refreshSchedules(socket);
        expect(line.getSchedules()).toEqual({});
    });

});
