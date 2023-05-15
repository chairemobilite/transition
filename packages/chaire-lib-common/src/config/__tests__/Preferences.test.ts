/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import { default as Preferences, PreferencesClass } from '../Preferences';
import { default as defaultPreferences, PreferencesModel } from '../defaultPreferences.config';
import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import fetchMock from 'jest-fetch-mock';

jest.mock('../../config/shared/project.config', () => {
    const config = require(process.env.PROJECT_CONFIG as string);
    return config;
})

const stubEmitter = new EventEmitter();
stubEmitter.on("preferences.update", (data, callback) => {
    callback("ok");
})

stubEmitter.on("preferences.updated", jest.fn());

beforeEach(() => {
    fetchMock.doMock();
    fetchMock.mockClear();
})

test("Test default preferences", () => {
    expect(Preferences.get("sections")).toMatchObject(defaultPreferences.sections);
    expect(Preferences.getDefault()).toMatchObject(defaultPreferences);
});

test("Test current match attributes", () => {
    expect(Preferences.current).toMatchObject(Preferences.getAttributes());
});

test("Test initialize PreferencesClass with custom attributes", () => {
    const preferences = new PreferencesClass({data: {foo: 'bar'}, osrmRouting: {directoryPrefix: 'newPrefix'}});
    expect(preferences.get("osrmRouting.directoryPrefix")).toBe("newPrefix");
    expect(preferences.getData("foo")).toBe("bar");
});

test("Test get preferences", () => {
    expect(Preferences.get("osrmRouting.directoryPrefix")).toBe("test");
});

test("Test set preferences", () => {
    Preferences.set("foo.bar", "foobar");
    expect(Preferences.get("foo.bar")).toBe("foobar");
});

test("Test update preferences", async () => {
    // Test adding a section to transition
    const sectionData = {
        localizedTitle: "myTitle",
        icon: "/path/to/my/icon",
        hasMapLayers: true
    }
    const myNewPrefs: Partial<PreferencesModel> = {
        sections: {
            test: {
                mySection: sectionData
            }
        }
    }
    await Preferences.update(stubEmitter, stubEmitter, myNewPrefs);
    expect(Preferences.get("sections.test.mySection")).toMatchObject(sectionData);
});

test("Test reset to default", () => {
    Preferences.set("defaultSection", "foo");
    expect(Preferences.get("defaultSection")).toBe("foo");
    Preferences.resetPathToDefault("defaultSection");
    expect(Preferences.get("defaultSection")).toBe("test"); // defaultSection is test in test project config
    Preferences.set("map.zoom", 15);
    expect(Preferences.get("map.zoom")).toBe(15);
    Preferences.resetPathToDefault("map.zoom");
    expect(Preferences.get("map.zoom")).toBe(10); // map.zoom is no set in project config, but is 10 in default config
});

test("Test get from default or project default", () => {
    Preferences.set("defaultSection", "foo");
    expect(Preferences.getFromDefault("defaultSection")).toBe("agencies");
    expect(Preferences.getFromProjectDefaultOrDefault("defaultSection")).toBe("test"); // defaultSection is test in test project config but agencies in default
    expect(Preferences.get("defaultSection")).toBe("foo"); // should not change users prefs value
    Preferences.set("map.zoom", 15);
    expect(Preferences.getFromDefault("map.zoom")).toBe(10);
    expect(Preferences.getFromProjectDefaultOrDefault("map.zoom")).toBe(10);
    expect(Preferences.get("map.zoom")).toBe(15); // should not change users prefs value
});

describe('Load preferences', () => {
    const preferences = { lang: 'fr', section: 'test', other: 'pref' };
    test("Load from socket routes", async () => {
        const testPreferences = Object.assign({}, preferences, { from: 'socket' });
        stubEmitter.on("preferences.read", (callback) => {
            callback(Status.createOk(testPreferences));
        })

        await Preferences.load(stubEmitter, stubEmitter);
        expect(Preferences.attributes).toEqual(expect.objectContaining(testPreferences));
    });

    test("Load from fetch", async () => {
        const testPreferences = Object.assign({}, preferences, { from: 'fetch' });
        fetchMock.mockOnce(JSON.stringify(Status.createOk(testPreferences)));

        await Preferences.load();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/load_user_preferences', expect.objectContaining({ 
            method: 'GET'
        }));
        expect(Preferences.attributes).toEqual(expect.objectContaining(testPreferences));
    });
})
