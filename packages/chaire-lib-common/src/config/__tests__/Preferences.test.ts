/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { default as Preferences, PreferencesClass } from '../Preferences';
import { default as defaultPreferences, PreferencesModel } from '../defaultPreferences.config';
import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import fetchMock from 'jest-fetch-mock';

jest.mock('../../config/shared/project.config', () => {
    const config = require(process.env.PROJECT_CONFIG as string);
    return config;
});

const stubEmitter = new EventEmitter();
const mockStubUpdatePreferences = jest.fn().mockImplementation((data, callback) => {
    callback(Status.createOk('ok'));
});
stubEmitter.on('preferences.update', mockStubUpdatePreferences);
const mockStubReadPreferences = jest.fn();
stubEmitter.on('preferences.read', mockStubReadPreferences);

const originalPreferences = _cloneDeep(Preferences.attributes);

beforeEach(() => {
    // Reset preferences to the default value
    Preferences.setAttributes(_cloneDeep(originalPreferences));
    jest.clearAllMocks();
    fetchMock.doMock();
    fetchMock.mockClear();
});

test('Test default preferences', () => {
    expect(Preferences.getDefault()).toMatchObject(defaultPreferences);
});

test('Test current match attributes', () => {
    expect(Preferences.current).toMatchObject(Preferences.attributes);
});

test('Test initialize PreferencesClass with custom attributes', () => {
    const preferences = new PreferencesClass({ data: { foo: 'bar' }, osrmRouting: { directoryPrefix: 'newPrefix' } });
    // TODO: Migrate this value from preferences to config like the osrm modes. See issue #1140
    expect(preferences.get('osrmRouting.directoryPrefix')).toBe('newPrefix');
    expect(preferences.getData('foo')).toBe('bar');
});

test('Test get preferences', () => {
    // TODO: Migrate this value from preferences to config like the osrm modes. See issue #1140
    expect(Preferences.get('osrmRouting.directoryPrefix')).toBe('test');
});

test('Test set preferences', () => {
    Preferences.set('foo.bar', 'foobar');
    expect(Preferences.get('foo.bar')).toBe('foobar');
});

describe('Updating preferences', () => {
    // Test adding an arbitrary object to the preferences
    const prefData = {
        localizedTitle: 'myTitle',
        icon: '/path/to/my/icon'
    };
    const myNewPrefs: Partial<PreferencesModel> = {
        prefTitle: {
            test: {
                mySection: prefData
            }
        }
    };

    test('Update Preferences object without dot notations', async () => {
        await Preferences.update(myNewPrefs, stubEmitter);
        expect(Preferences.get('prefTitle.test.mySection')).toMatchObject(prefData);
        expect(Preferences.get('prefTitle.test', {})).toMatchObject({
            mySection: prefData
        });
    });

    test('Update Preferences object with dot notations', async () => {
        await Preferences.update({
            'prefTitle.test.mySection': prefData
        }, stubEmitter);
        expect(Preferences.get('prefTitle.test.mySection')).toMatchObject(prefData);
        // make sure it has correctly set the values as objects
        // If this fails, it means that lodash set was not called and a key named 'prefTitle.test.mySection' was created in the Preference object, which is incorrect
        expect(Preferences.get('prefTitle.test', {})).toMatchObject({
            mySection: prefData
        });
    });

    test('Update from socket routes', async () => {
        await Preferences.update(myNewPrefs, stubEmitter);

        expect(mockStubUpdatePreferences).toHaveBeenLastCalledWith(myNewPrefs, expect.anything());
        expect(Preferences.get('prefTitle.test.mySection')).toMatchObject(prefData);
    });

    test('Update from socket routes, with error', async () => {
        mockStubUpdatePreferences.mockImplementationOnce((data, callback) => callback(Status.createError('Error from socket')));

        await Preferences.update(myNewPrefs, stubEmitter);
        expect(mockStubUpdatePreferences).toHaveBeenLastCalledWith(myNewPrefs, expect.anything());
        // No changes to preferences should happen
        expect(Preferences.get('prefTitle.test.mySection')).toBeUndefined();
    });

    test('Update from fetch', async () => {
        fetchMock.mockOnce(JSON.stringify(Status.createOk('ok')));

        await Preferences.update(myNewPrefs);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/update_user_preferences', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ valuesByPath: myNewPrefs })
        }));
        expect(Preferences.get('prefTitle.test.mySection')).toMatchObject(prefData);
    });

    test('Update from fetch, with error', async () => {
        fetchMock.mockOnce(JSON.stringify(Status.createError('Error from fetch')));

        await Preferences.update(myNewPrefs);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/update_user_preferences', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ valuesByPath: myNewPrefs })
        }));
        // No changes to preferences should happen
        expect(Preferences.get('prefTitle.test.mySection')).toBeUndefined();
    });

    test('Update map.preferredBaseLayer preference', async () => {
        fetchMock.mockOnce(JSON.stringify(Status.createOk('ok')));

        const layerPref = { 'map.preferredBaseLayer': 'aerial' as const };
        await Preferences.update(layerPref);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/update_user_preferences', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ valuesByPath: layerPref })
        }));
        expect(Preferences.get('map.preferredBaseLayer')).toBe('aerial');

        // Reset to osm
        fetchMock.mockOnce(JSON.stringify(Status.createOk('ok')));
        await Preferences.update({ 'map.preferredBaseLayer': 'osm' as const });
        expect(Preferences.get('map.preferredBaseLayer')).toBe('osm');
    });
});

test('Test reset to default', () => {
    Preferences.set('defaultSection', 'foo');
    expect(Preferences.get('defaultSection')).toBe('foo');
    Preferences.resetPathToDefault('defaultSection');
    expect(Preferences.get('defaultSection')).toBe('test'); // defaultSection is test in test project config
    Preferences.set('map.zoom', 15);
    expect(Preferences.get('map.zoom')).toBe(15);
    Preferences.resetPathToDefault('map.zoom');
    expect(Preferences.get('map.zoom')).toBe(10); // map.zoom is no set in project config, but is 10 in default config
});

test('Test map.preferredBaseLayer preference', () => {
    // Test default value
    expect(Preferences.get('map.preferredBaseLayer')).toBe('osm');

    // Test setting to aerial
    Preferences.set('map.preferredBaseLayer', 'aerial');
    expect(Preferences.get('map.preferredBaseLayer')).toBe('aerial');

    // Test resetting to default
    Preferences.resetPathToDefault('map.preferredBaseLayer');
    expect(Preferences.get('map.preferredBaseLayer')).toBe('osm');

    // Test that it persists as part of map preferences
    Preferences.set('map.preferredBaseLayer', 'aerial');
    const mapPrefs = Preferences.get('map');
    expect(mapPrefs).toHaveProperty('preferredBaseLayer', 'aerial');
});

test('Test get from default or project default', () => {
    Preferences.set('defaultSection', 'foo');
    expect(Preferences.getFromDefault('defaultSection')).toBe('agencies');
    expect(Preferences.getFromProjectDefaultOrDefault('defaultSection')).toBe('test'); // defaultSection is test in test project config but agencies in default
    expect(Preferences.get('defaultSection')).toBe('foo'); // should not change users prefs value
    Preferences.set('map.zoom', 15);
    expect(Preferences.getFromDefault('map.zoom')).toBe(10);
    expect(Preferences.getFromProjectDefaultOrDefault('map.zoom')).toBe(10);
    expect(Preferences.get('map.zoom')).toBe(15); // should not change users prefs value
});

describe('Load preferences', () => {
    const preferences = { lang: 'fr', section: 'test', other: 'pref' };
    test('Load from socket routes', async () => {
        const testPreferences = Object.assign({}, preferences, { from: 'socket' });
        mockStubReadPreferences.mockImplementationOnce((callback) => {
            callback(Status.createOk(testPreferences));
        });

        await Preferences.load(stubEmitter);
        expect(Preferences.attributes).toEqual(expect.objectContaining(testPreferences));
    });

    test('Load from socket routes, with error', async () => {
        const currentPrefs = Preferences.attributes;
        mockStubReadPreferences.mockImplementationOnce((callback) => {
            callback(Status.createError('Error from socket'));
        });

        await Preferences.load(stubEmitter);
        // No changes to preferences should happen
        expect(Preferences.attributes).toEqual(currentPrefs);
    });

    test('Load from fetch', async () => {
        const testPreferences = Object.assign({}, preferences, { from: 'fetch' });
        fetchMock.mockOnce(JSON.stringify(Status.createOk(testPreferences)));

        await Preferences.load();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/load_user_preferences', expect.objectContaining({
            method: 'GET'
        }));
        expect(Preferences.attributes).toEqual(expect.objectContaining(testPreferences));
    });

    test('Load from fetch, with error', async () => {
        const currentPrefs = Preferences.attributes;
        fetchMock.mockOnce(JSON.stringify(Status.createError('Error from fetch')));

        await Preferences.load();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/load_user_preferences', expect.objectContaining({
            method: 'GET'
        }));
        // No changes to preferences should happen
        expect(Preferences.attributes).toEqual(currentPrefs);
    });
});

describe('Preferences listener', () => {
    const prefChangedListener = jest.fn();

    beforeEach(() => {
        prefChangedListener.mockClear();
    });

    afterEach(() => {
        Preferences.removeChangeListener(prefChangedListener);
    });

    test('Listen on update', async () => {
        const myNewPrefs: Partial<PreferencesModel> = {
            prefTitle: {
                test: {
                    mySection: {
                        localizedTitle: 'prefTitle',
                        icon: '/path/to/my/icon'
                    }
                }
            }
        };

        fetchMock.mockOnce(JSON.stringify(Status.createOk('ok')));
        fetchMock.mockOnce(JSON.stringify(Status.createOk('ok')));

        // Add listener
        Preferences.addChangeListener(prefChangedListener);

        // Save the data and make sure the listener has been called
        await Preferences.update(myNewPrefs);

        expect(prefChangedListener).toHaveBeenCalledTimes(1);
        expect(prefChangedListener).toHaveBeenCalledWith(myNewPrefs);

        // Remove the listener, save the data and make sure the listener has not been called again
        Preferences.removeChangeListener(prefChangedListener);

        await Preferences.update({ sections: _cloneDeep(originalPreferences.sections) });

        expect(prefChangedListener).toHaveBeenCalledTimes(1);
    });

    test('Listen on update with error, no call expected', async () => {
        const myNewPrefs: Partial<PreferencesModel> = {
            prefTitle: {
                test: {
                    mySection: {
                        localizedTitle: 'prefTitle',
                        icon: '/path/to/my/icon'
                    }
                }
            }
        };

        fetchMock.mockOnce(JSON.stringify(Status.createError('error')));

        // Add listeners
        Preferences.addChangeListener(prefChangedListener);

        // Save the data and make sure the listener has been called
        await Preferences.update(myNewPrefs);

        expect(prefChangedListener).not.toHaveBeenCalled();
    });

    test('Listen on load', async () => {
        const testPreferences = Object.assign({}, _cloneDeep(originalPreferences), { from: 'fetch' });
        fetchMock.mockOnce(JSON.stringify(Status.createOk(testPreferences)));
        fetchMock.mockOnce(JSON.stringify(Status.createOk(testPreferences)));

        // Add listener
        Preferences.addChangeListener(prefChangedListener);

        // Save the data and make sure the listener has been called
        await Preferences.load();

        expect(prefChangedListener).toHaveBeenCalledTimes(1);
        expect(prefChangedListener).toHaveBeenCalledWith(testPreferences);

        // Remove the listener, save the data and make sure the listener has not been called again
        Preferences.removeChangeListener(prefChangedListener);

        await Preferences.load();

        expect(prefChangedListener).toHaveBeenCalledTimes(1);
    });

    test('Listen on load with error, no call expected', async () => {
        fetchMock.mockOnce(JSON.stringify(Status.createError('error')));

        // Add listeners
        Preferences.addChangeListener(prefChangedListener);

        // Save the data and make sure the listener has been called
        await Preferences.load();

        expect(prefChangedListener).not.toHaveBeenCalled();
    });

});
