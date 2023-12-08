/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { GenericObject, GenericAttributes } from '../GenericObject';
import { MapObject, MapObjectAttributes } from '../MapObject';

const defaultAttributes = {
    name: 'Transit stop',
    color: 'red',
    geography: {
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [-73.6, 45.5]
        },
        properties: {
            name: 'Transit stop'
        }
    }
};

class SomeMapObject extends MapObject<GeoJSON.Point, MapObjectAttributes<GeoJSON.Point>>
{
    public constructor(attributes = {}, isNew = true)
    {
        super(attributes, isNew, null);
    }
}

describe('hasChangedGeography', () => {
    
    test('not changed for empty object', () => {
        const object = new SomeMapObject({}, true);
        expect(object.hasChangedGeography()).toEqual(false);
    });

    test('changed for new object with geography', () => {
        const object = new SomeMapObject({
            name: 'test',
            geography: { coordinates: [-73, 45] }
        }, true);
        expect(object.hasChangedGeography()).toEqual(true);
    });

    test('not changed when geography not changed', () => {
        const object = new SomeMapObject({
            name: 'test',
            geography: { coordinates: [-73, 45] }
        }, false);
        object.startEditing();
        object.set('name', 'new name');
        expect(object.hasChangedGeography()).toEqual(false);
    });

    test('changed when geography modified', () => {
        const object = new SomeMapObject({
            name: 'test',
            geography: { coordinates: [-73, 45] }
        }, false);
        object.startEditing();
        object.set('geography', { coordinates: [-74, 46] });
        expect(object.hasChangedGeography()).toEqual(true);
    });

    test('not changed, even if geography changed in history', () => {
        const object = new SomeMapObject({
            name: 'test',
            geography: { coordinates: [-73, 45] }
        }, false);
        object.startEditing();
        // Set a geography and go back to original
        object.set('geography', { coordinates: [-74, 46] });
        object.set('geography', { coordinates: [-73, 45] });
        expect(object.hasChangedGeography()).toEqual(false);
    });
})