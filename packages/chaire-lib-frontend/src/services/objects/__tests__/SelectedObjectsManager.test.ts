/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import SelectedObjectsManager from '../SelectedObjectsManager';
import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';

const eventManager = EventManagerMock.eventManagerMock;

beforeEach(() => {
    EventManagerMock.mockClear();
})
  
test('should construct from selected object names', function() {
    const selectedObjectsManager = new SelectedObjectsManager(eventManager as any, [
      'foo',
      'bar'
    ]);
    expect(selectedObjectsManager.isSelected('foo')).toBe(false);
    expect(selectedObjectsManager.isSelected('bar')).toBe(false);
    selectedObjectsManager.deselect('bar');
    expect(selectedObjectsManager.isSelected('bar')).toBe(false);
    expect(selectedObjectsManager.get('foo')).toBe(undefined);
    expect(selectedObjectsManager.get('bar')).toBe(undefined);
    
});

test('should select and deselect an object', function() {
    const selectedObjectsManager = new SelectedObjectsManager(eventManager as any, [
      'foo',
      'bar'
    ]);
    selectedObjectsManager.select('foo', { test1: 'foo', test2: 'bar' }); // alias of set
    expect(selectedObjectsManager.isSelected('foo')).toBe(true);
    expect(selectedObjectsManager.isSelected('bar')).toBe(false);
    expect(selectedObjectsManager.get('foo')).toEqual({ test1: 'foo', test2: 'bar' });
    expect(selectedObjectsManager.get('bar')).toBe(undefined);
    selectedObjectsManager.deselect('foo');
    expect(selectedObjectsManager.isSelected('foo')).toBe(false);
    expect(selectedObjectsManager.get('foo')).toBe(undefined);
    expect(selectedObjectsManager.get('bar')).toBe(undefined);

    selectedObjectsManager.set('foo', { test1: 'foo', test2: 'bar'});
    expect(selectedObjectsManager.isSelected('foo')).toBe(true);
    expect(selectedObjectsManager.get('foo')).toEqual({ test1: 'foo', test2: 'bar' });
    selectedObjectsManager.deselect('foo');
    expect(selectedObjectsManager.isSelected('foo')).toBe(false);
    expect(selectedObjectsManager.get('foo')).toBe(undefined);

    selectedObjectsManager.update('foo', { test1: 'foo', test2: 'bar'}); // alias of set
    expect(selectedObjectsManager.isSelected('foo')).toBe(true);
    expect(selectedObjectsManager.get('foo')).toEqual({ test1: 'foo', test2: 'bar' });
    selectedObjectsManager.deselect('foo');
    expect(selectedObjectsManager.isSelected('foo')).toBe(false);
    expect(selectedObjectsManager.get('foo')).toBe(undefined);
});

test('should update and validate an object', function() {
    const selectedObjectsManager = new SelectedObjectsManager(eventManager as any, [
      'foo',
      'bar'
    ]);
    selectedObjectsManager.set('foo', { 
      validate: function() {
        return false;
      },
      attributes: { test1: 'foo', test2: 'bar' }
    });

    expect(selectedObjectsManager.isSelected('foo')).toBe(true);
    expect((selectedObjectsManager.get('foo') as any).validate()).toBe(false);
    expect((selectedObjectsManager.get('foo') as any).attributes).toEqual({ test1: 'foo', test2: 'bar' });
    selectedObjectsManager.validate('foo', { 
      validate: function() {
        return true;
      },
      attributes: { test3: 'foo', test4: 'bar' }
    });
    expect((selectedObjectsManager.get('foo') as any).attributes).toEqual({ test3: 'foo', test4: 'bar' });
    expect((selectedObjectsManager.get('foo') as any).validate()).toBe(true);
    selectedObjectsManager.updateAndValidate('foo', { // alias
      validate: function() {
        return true;
      },
      attributes: { test5: 'foo', test6: 'bar' }
    });
    expect((selectedObjectsManager.get('foo') as any).attributes).toEqual({ test5: 'foo', test6: 'bar' });
    expect((selectedObjectsManager.get('foo') as any).validate()).toBe(true);
    selectedObjectsManager.updateAndValidate('foo', { // alias
      validate: function() {
        return true;
      },
      attributes: { test7: 'foo', test8: 'bar' }
    });
    expect((selectedObjectsManager.get('foo') as any).attributes).toEqual({ test7: 'foo', test8: 'bar' });
    expect((selectedObjectsManager.get('foo') as any).validate()).toBe(true);
    
});

test('getSelectedObjects', function() {
    const selectedObjectsManager = new SelectedObjectsManager(eventManager as any, [
      'foo',
      'bar',
      'foobar'
    ]);
    expect(selectedObjectsManager.getSelectedObjects()).toEqual([]);

    selectedObjectsManager.set('foo', {});
    expect(selectedObjectsManager.getSelectedObjects()).toEqual(['foo']);

    selectedObjectsManager.set('bar', {});
    expect(selectedObjectsManager.getSelectedObjects()).toEqual(['foo', 'bar']);

    selectedObjectsManager.select('foobar', {});
    expect(selectedObjectsManager.getSelectedObjects()).toEqual(['foo', 'bar', 'foobar']);

    selectedObjectsManager.deselect('foobar');
    expect(selectedObjectsManager.getSelectedObjects()).toEqual(['foo', 'bar']);

    selectedObjectsManager.deselect('foo');
    expect(selectedObjectsManager.getSelectedObjects()).toEqual(['bar']);

    selectedObjectsManager.deselect('bar');
    expect(selectedObjectsManager.getSelectedObjects()).toEqual([]);
    
});

