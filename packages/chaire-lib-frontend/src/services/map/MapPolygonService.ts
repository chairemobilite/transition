/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import GeoJson from 'geojson';
import maplibregl from 'maplibre-gl';

// Store event handlers to allow proper cleanup
interface DrawEventHandlers {
    modeChangeHandler: (data: any) => void;
    createHandler: (data: any) => void;
    updateHandler: (data: any) => void;
    deleteHandler: (data: any) => void;
    selectionChangeHandler: () => void;
}

// WeakMap to store handlers associated with each draw instance
const drawHandlersMap = new WeakMap<MapboxDraw, DrawEventHandlers>();

const getMapBoxDraw = (
    map: maplibregl.Map,
    modeChangeCallback: (p: GeoJson.Polygon) => void,
    createCallback: (p: GeoJson.Polygon) => void,
    deleteCallback: (p: GeoJson.Polygon) => void,
    updateCallback?: (p: GeoJson.Polygon) => void
): MapboxDraw => {
    const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true
        }
    });
    map.addControl(draw);

    // Replace mapboxgl classes with maplibregl classes to match the styling
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
        // Get the map container to scope queries to this specific map instance
        const mapContainer = map.getContainer();
        if (mapContainer) {
            // Find the draw controls container (has mapboxgl-ctrl-group class from MapboxDraw)
            const drawControls = mapContainer.querySelector('.mapboxgl-ctrl-group');
            if (drawControls) {
                // Add MapLibre classes
                drawControls.classList.add('maplibregl-ctrl-group', 'maplibregl-ctrl');

                // Update button classes
                const buttons = drawControls.querySelectorAll('button');
                buttons.forEach((button) => {
                    button.classList.add('maplibregl-ctrl-icon');
                });
            }
        }
    });

    // Function to toggle trash button visibility based on selection
    const updateTrashButtonVisibility = () => {
        if (!draw) return; // Guard against draw being null

        const mapContainer = map.getContainer();
        const trashButton = mapContainer?.querySelector('.mapbox-gl-draw_trash');
        if (trashButton) {
            try {
                const allFeatures = draw.getAll();
                // Show trash button only if there are drawn features
                if (allFeatures && allFeatures.features && allFeatures.features.length > 0) {
                    trashButton.classList.add('active');
                } else {
                    trashButton.classList.remove('active');
                }
            } catch (error) {
                // If there's an error, hide the trash button
                console.error('Error getting selected IDs:', error);
                trashButton.classList.remove('active');
            }
        }
    };

    // Create and store event handlers
    const handlers: DrawEventHandlers = {
        modeChangeHandler: (data: any) => {
            modeChangeCallback(data);
            updateTrashButtonVisibility();
        },
        createHandler: (data: any) => {
            if (data && data.features && data.features.length > 0) {
                createCallback(data.features[0]);
                updateTrashButtonVisibility();
            }
        },
        updateHandler: (data: any) => {
            // Call updateCallback when polygon is modified (e.g., dragged)
            if (updateCallback && data.features && data.features.length > 0) {
                updateCallback(data.features[0]);
            }
            updateTrashButtonVisibility();
        },
        deleteHandler: (data: any) => {
            if (data && data.features && data.features.length > 0) {
                deleteCallback(data.features[0]);
                updateTrashButtonVisibility();
            }
        },
        selectionChangeHandler: () => {
            updateTrashButtonVisibility();
        }
    };

    // Store handlers in WeakMap for later cleanup
    drawHandlersMap.set(draw, handlers);

    // Attach event listeners
    map.on('draw.modechange', handlers.modeChangeHandler);
    map.on('draw.create', handlers.createHandler);
    map.on('draw.update', handlers.updateHandler);
    map.on('draw.delete', handlers.deleteHandler);
    map.on('draw.selectionchange', handlers.selectionChangeHandler);

    return draw;
};

const removeMapBoxDraw = (map: maplibregl.Map, draw: MapboxDraw): void => {
    // Retrieve the stored handlers for this draw instance
    const handlers = drawHandlersMap.get(draw);

    if (handlers) {
        // Remove event listeners using the exact same function references
        map.off('draw.modechange', handlers.modeChangeHandler);
        map.off('draw.create', handlers.createHandler);
        map.off('draw.update', handlers.updateHandler);
        map.off('draw.delete', handlers.deleteHandler);
        map.off('draw.selectionchange', handlers.selectionChangeHandler);

        // Clean up the WeakMap entry
        drawHandlersMap.delete(draw);
    }

    draw.onRemove();
};

export { getMapBoxDraw, removeMapBoxDraw };
