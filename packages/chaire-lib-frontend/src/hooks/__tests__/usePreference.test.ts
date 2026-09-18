/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { act, renderHook } from '@testing-library/react';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { usePreference } from '../usePreference';

const path = 'dummy.path';
const defaultValue = 'defaultValue';
const newValue = 'newValue';

const socketStub = new EventEmitter();
const mockUpdatePreferences = jest.fn().mockImplementation((_data, callback) => {
    callback(Status.createOk('ok'));
});
socketStub.on('preferences.update', mockUpdatePreferences);

beforeAll(() => serviceLocator.addService('socketEventManager', socketStub));
afterAll(() => serviceLocator.removeService('socketEventManager'));

beforeEach(() => {
    Preferences.set(path, undefined);
    jest.clearAllMocks();
});

const renderUsePreference = () =>
    renderHook(() => {
        const [value, setValue] = usePreference(path, defaultValue);
        return { value, setValue };
    });

describe('usePreference', () => {
    test('Returns the default value when the preference is not set', () => {
        const { result } = renderUsePreference();
        expect(result.current.value).toEqual(defaultValue);
    });

    test('Setter persists the preference and updates the hook', async () => {
        const { result } = renderUsePreference();

        await act(async () => result.current.setValue(newValue));

        expect(mockUpdatePreferences).toHaveBeenCalledWith({ [path]: newValue }, expect.any(Function));
        expect(Preferences.get(path)).toEqual(newValue);
        expect(result.current.value).toEqual(newValue);
    });

    test('Updates every hook using the same preference', async () => {
        const first = renderUsePreference();
        const second = renderUsePreference();

        await act(async () => first.result.current.setValue(newValue));

        expect(second.result.current.value).toEqual(newValue);
    });

    test('Removes its change listener on unmount', () => {
        const addListenerSpy = jest.spyOn(Preferences, 'addChangeListener');
        const removeListenerSpy = jest.spyOn(Preferences, 'removeChangeListener');
        const { unmount } = renderUsePreference();
        const [listener] = addListenerSpy.mock.calls[0];

        unmount();

        expect(removeListenerSpy).toHaveBeenCalledWith(listener);
    });
});
