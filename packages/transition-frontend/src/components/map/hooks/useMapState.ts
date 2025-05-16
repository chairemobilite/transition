/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import _throttle from 'lodash/throttle';
import { WebMercatorViewport } from '@deck.gl/core';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import {
    getDefaultViewState,
    shouldUpdatePreferences,
    viewStateHasChanged
} from '../defaults/TransitionMainMapDefaults';

const THROTTLE_DELAY = 25; // milliseconds

export const useMapState = (initialCenter: [number, number], initialZoom: number) => {
    const [initialViewState, setInitialViewState] = useState(getDefaultViewState(initialCenter, initialZoom));
    const zoomRef = useRef<number>(initialZoom);
    const viewportRef = useRef<WebMercatorViewport | null>(null);
    const stateHasBeenSet = useRef(false);
    const viewStateRef = useRef(initialViewState);

    // Update viewport reference with current view state
    const updateViewportRef = useCallback((newViewState) => {
        viewportRef.current = new WebMercatorViewport(newViewState);
    }, []);

    // Update the ref whenever viewState changes
    useEffect(() => {
        viewStateRef.current = initialViewState;
    }, [initialViewState]);

    // Throttled preference updates once per second
    const throttledUpdatePref = useCallback(
        _throttle((updatedViewState) => {
            Preferences.update(
                {
                    'map.zoom': updatedViewState.zoom,
                    'map.center': [updatedViewState.longitude, updatedViewState.latitude]
                },
                serviceLocator.socketEventManager,
                false
            );
        }, 1000),
        []
    );

    // Update user preferences
    // FIXME The mouse coordinates appear nowhere on the map, so this function is not necessary
    /* const updateUserPrefs = useCallback((updatedViewState) => {
        // Update user preferences once per second if required
        throttledUpdatePref(updatedViewState);
        serviceLocator.eventManager.emit('map.updateMouseCoordinates', [
            updatedViewState.longitude,
            updatedViewState.latitude
        ]);
    }, []); */

    // Replace the existing throttled implementation with this:
    const throttledSetViewState = useCallback(
        _throttle((newViewState) => {
            updateViewportRef(newViewState);
            setInitialViewState(newViewState);
            //updateUserPrefs(newViewState);
            zoomRef.current = newViewState.zoom;
        }, THROTTLE_DELAY),
        [updateViewportRef]
    );

    // View state change handler
    const onViewStateChange = useCallback(
        ({ viewState: newViewState, oldViewState }: { viewState: any; oldViewState?: any }) => {
            // Make sure the state if set the first time this function is called
            if (stateHasBeenSet.current === false) {
                throttledSetViewState(newViewState);
                stateHasBeenSet.current = true;
            } else if (viewStateHasChanged(oldViewState, newViewState)) {
                // FIXME Ideally we wouldn't want to manage the zoom part of the state, but we need to make sure layers are updated when zooming. Find a better way to tell the layers to redraw.
                throttledSetViewState(newViewState);
            }
            if (shouldUpdatePreferences(oldViewState, newViewState)) {
                throttledUpdatePref(newViewState);
            }
            return newViewState; // Allow the view state to update
        },
        [throttledSetViewState]
    );

    // Resize handler
    const onResize = useCallback(({ width, height }) => {
        viewportRef.current = new WebMercatorViewport({
            ...viewStateRef.current,
            width,
            height
        });
        throttledSetViewState({
            ...viewStateRef.current,
            width,
            height
        });
    }, []);

    // Fit bounds handler
    const fitBounds = useCallback((bounds: [[number, number], [number, number]]) => {
        setInitialViewState((prevViewState) => {
            const viewport = new WebMercatorViewport(prevViewState).fitBounds(bounds, {
                padding: 20
            });

            const { latitude, longitude, zoom } = viewport;
            const newViewState = {
                ...prevViewState,
                latitude,
                longitude,
                zoom
            };
            zoomRef.current = newViewState.zoom;
            viewportRef.current = viewport;
            return newViewState;
        });
    }, []);

    const flyTo = useCallback(({ latitude, longitude, zoom }) => {
        setInitialViewState((prevViewState) => {
            const newViewState = {
                ...prevViewState,
                latitude,
                longitude,
                zoom
                // FIXME It would be nice to have a transition with transitionInterpolator: new FlyToInterpolator({speed: 2}), but our state managements clashes with the transition because the state is changed during the transition and any mouse move in the meantime will cause the transition to stop. See if we can prevent our state update during transition, if there's an event marking its end.
            };
            const viewport = new WebMercatorViewport(newViewState);
            zoomRef.current = newViewState.zoom;
            viewportRef.current = viewport;
            throttledUpdatePref(newViewState);
            return newViewState;
        });
    }, []);

    useEffect(() => {
        // Also initialize viewport if needed
        if (!viewportRef.current) {
            viewportRef.current = new WebMercatorViewport(initialViewState);
        }
    }, []); // Empty dependency array means this runs once after initial render

    return {
        viewState: initialViewState,
        zoomRef,
        viewportRef,
        onViewStateChange,
        onResize,
        fitBounds,
        flyTo
    };
};
