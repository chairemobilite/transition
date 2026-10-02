/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { PreferenceType } from 'chaire-lib-common/lib/config/defaultPreferences.config';
import React from 'react';

/**
 * Subscribes to a single user preference, keeping the returned value in sync
 * across every component using it. The setter persists the new value to the
 * server.
 *
 * @param path Dot-separated path to the preference
 * @param defaultValue Value to return when the preference is not set
 * @returns A [value, setValue] tuple, similar to useState
 */
export const usePreference = <P extends string>(
    path: P,
    defaultValue?: PreferenceType<P>
): [PreferenceType<P>, (value: PreferenceType<P>) => void] => {
    type T = PreferenceType<P>;

    const subscribe = React.useCallback((onStoreChange: () => void) => {
        Preferences.addChangeListener(onStoreChange);
        return () => Preferences.removeChangeListener(onStoreChange);
    }, []);

    const getSnapshot = React.useCallback((): T => Preferences.get(path, defaultValue), [path, defaultValue]);

    const value = React.useSyncExternalStore(subscribe, getSnapshot);

    const setValue = React.useCallback(
        (newValue: T) => {
            Preferences.update({ [path]: newValue }, serviceLocator.socketEventManager);
        },
        [path]
    );

    return [value, setValue];
};

export default usePreference;
