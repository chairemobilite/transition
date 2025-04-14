/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Preferences from 'chaire-lib-common/lib/config/Preferences';

export const getDefaultViewState = (
    center: [number, number] = Preferences.get('map.center'),
    zoom: number = Preferences.get('map.zoom')
) => ({
    longitude: center[0],
    latitude: center[1],
    zoom,
    pitch: 0,
    bearing: 0
});

/**
 * Whether the view state has changed from our perspective. A simple change in
 * lat/lon should not trigger a state change, but zoom and width/height, yes
 *
 * @param previousState The previous state
 * @param newState The new state
 * @returns
 */
export const viewStateHasChanged = (previousState: any, newState: any) => {
    return (
        // previousState.latitude !== newState.latitude ||
        // previousState.longitude !== newState.longitude ||
        previousState.zoom !== newState.zoom ||
        previousState.width !== newState.width ||
        previousState.height !== newState.height
    );
};

/**
 * Whether the user preferences should be updated after a state change. Lat/lon
 * and zoom should update the preferences
 *
 * @param previousState The previous state
 * @param newState The next state
 */
export const shouldUpdatePreferences = (previousState: any, newState: any) => {
    return (
        previousState.latitude !== newState.latitude ||
        previousState.longitude !== newState.longitude ||
        previousState.zoom !== newState.zoom
    );
};
