/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import Line from '../Line';
import LineCollection from '../LineCollection';
import { lineAttributesBaseData, lineAttributesMinimalData } from './LineData.test';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct line collection with or without features', function() {

    const line1 = new Line(lineAttributesBaseData, true);
    const line2 = new Line(lineAttributesMinimalData, false);

    const collectionEmpty = new LineCollection([], {}, eventManager);
    const collection2 = new LineCollection([line1], {}, eventManager);

    expect(collectionEmpty.size()).toBe(0);
    expect(collection2.size()).toBe(1);

    expect(collectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(collection2.getFeatures()[0]).toMatchObject(line1);
    expect(collectionEmpty.getById(lineAttributesBaseData.id)).toBeUndefined();
    expect(collection2.getById(lineAttributesBaseData.id)).toMatchObject(line1);

    collectionEmpty.add(line1);
    expect(collectionEmpty.size()).toBe(1);
    expect(collectionEmpty.getById(lineAttributesBaseData.id)).toMatchObject(line1);
    collectionEmpty.removeById(lineAttributesBaseData.id);
    expect(collectionEmpty.size()).toBe(0);
    expect(collectionEmpty.getFeatures()[0]).toBeUndefined();

    expect(collection2.forJson()[0]).toEqual(lineAttributesBaseData);
    expect(collection2.forCsv()[0]).toEqual({
        uuid: lineAttributesBaseData.id,
        shortname: lineAttributesBaseData.shortname,
        longname: lineAttributesBaseData.longname,
        mode: lineAttributesBaseData.mode,
        category: lineAttributesBaseData.category,
        agency_uuid: lineAttributesBaseData.agency_id,
        internal_id: undefined,
        color: undefined,
        is_autonomous: String(lineAttributesBaseData.is_autonomous),
        allow_same_line_transfers: String(lineAttributesBaseData.allow_same_line_transfers)
    });

});

test('Load from server', async () => {
    EventManagerMock.emitResponseReturnOnce({collection: [lineAttributesBaseData, lineAttributesMinimalData]});

    // Test loading a simple collection
    const collection = new LineCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitLines.collection', null, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const line1 = collection.getFeatures()[0];
    const line2 = collection.getFeatures()[1];
    expect(line1).toEqual(new Line(lineAttributesBaseData, false));
    expect(line2).toEqual(new Line(lineAttributesMinimalData, false));
    expect(line1.collectionManager).toEqual(collectionManager);
    expect(line2.collectionManager).toEqual(collectionManager);

});

test('static attributes', () => {
    const collection = new LineCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('Lines');
    expect(collection.socketPrefix).toEqual('transitLines');
    expect(collection.displayName).toEqual('LineCollection');
});

test('getByAgencyId', () => {
    const line1 = new Line(lineAttributesBaseData, true);
    const line2 = new Line(lineAttributesMinimalData, false);

    const collection = new LineCollection([line1, line2], {}, eventManager);

    expect(collection.getByAgencyId('not an agency')).toEqual([]);
    expect(collection.getByAgencyId(lineAttributesBaseData.agency_id)).toEqual([line1]);
})
