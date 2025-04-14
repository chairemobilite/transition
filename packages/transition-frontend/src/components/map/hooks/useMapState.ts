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
import { getDefaultViewState, viewStateHasChanged } from '../defaults/TransitionMainMapDefaults';

const THROTTLE_DELAY = 25; // milliseconds

export const useMapState = (initialCenter: [number, number], initialZoom: number) => {
    const [viewState, setViewState] = useState(getDefaultViewState(initialCenter, initialZoom));
    const zoomRef = useRef<number>(initialZoom);
    const viewportRef = useRef<WebMercatorViewport | null>(null);
    const stateHasBeenSet = useRef(false);
    const viewStateRef = useRef(viewState);

    // Update viewport reference with current view state
    const updateViewportRef = useCallback((newViewState) => {
        viewportRef.current = new WebMercatorViewport(newViewState);
    }, []);

    // Update the ref whenever viewState changes
    useEffect(() => {
        viewStateRef.current = viewState;
    }, [viewState]);

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
    const updateUserPrefs = useCallback((updatedViewState) => {
        // Update user preferences once per second if required
        throttledUpdatePref(updatedViewState);
        serviceLocator.eventManager.emit('map.updateMouseCoordinates', [
            updatedViewState.longitude,
            updatedViewState.latitude
        ]);
    }, []);

    // Replace the existing throttled implementation with this:
    const throttledSetViewState = useCallback(
        _throttle((newViewState) => {
            updateViewportRef(newViewState);
            setViewState(newViewState);
            updateUserPrefs(newViewState);
            zoomRef.current = newViewState.zoom;
        }, THROTTLE_DELAY),
        [updateViewportRef, updateUserPrefs]
    );

    // View state change handler
    const onViewStateChange = useCallback(
        ({ viewState: newViewState, oldViewState }: { viewState: any; oldViewState?: any }) => {
            // Make sure the state if set the first time this function is called
            if (stateHasBeenSet.current === false) {
                throttledSetViewState(newViewState);
                stateHasBeenSet.current = true;
            } else if (viewStateHasChanged(oldViewState, newViewState)) {
                throttledSetViewState(newViewState);
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
    }, []);

    // Fit bounds handler
    const fitBounds = useCallback((bounds: [[number, number], [number, number]]) => {
        setViewState((prevViewState) => {
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

    useEffect(() => {
        // Also initialize viewport if needed
        if (!viewportRef.current) {
            viewportRef.current = new WebMercatorViewport(viewState);
        }
    }, []); // Empty dependency array means this runs once after initial render

    return {
        viewState,
        zoomRef,
        viewportRef,
        onViewStateChange,
        onResize,
        fitBounds
    };
};
