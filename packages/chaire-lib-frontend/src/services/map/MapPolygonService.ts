/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GeoJson from 'geojson';
import { IControl, Map as MapLibreGLMap } from 'maplibre-gl';
import { TerraDraw, TerraDrawSelectMode, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan, faDrawPolygon } from '@fortawesome/free-solid-svg-icons';

// Define the wrapper interface to match what TransitionMainMap expects
export interface TerraDrawAdapter {
    getAll: () => GeoJson.FeatureCollection;
    deleteAll: () => TerraDrawAdapter;
    add: (geojson: GeoJson.Feature<GeoJson.Polygon> | GeoJson.FeatureCollection<GeoJson.Polygon>) => string[]; // Returns IDs
    reset: () => void;
    onRemove: () => void;
}

// Store draw instances associated with the map to ensure we can clean up any existing instance
// regardless of the adapter wrapper reference. Use a Map<MapLibreGLMap, TerraDraw>
const mapDrawInstances = new WeakMap<MapLibreGLMap, TerraDraw>();
const mapControls = new WeakMap<MapLibreGLMap, TerraDrawControl>();

class TerraDrawControl implements IControl {
    _map: MapLibreGLMap | undefined;
    _container!: HTMLElement;
    _draw: TerraDraw;
    _polygonButton!: HTMLButtonElement;
    _trashButton!: HTMLButtonElement;
    _deleteCallback: (p: GeoJson.Feature<GeoJson.Polygon>) => void;
    _modeChangeCallback: (p: { mode: string }) => void;

    constructor(
        draw: TerraDraw,
        modeChangeCallback: (p: { mode: string }) => void,
        deleteCallback: (p: GeoJson.Feature<GeoJson.Polygon>) => void
    ) {
        this._draw = draw;
        this._modeChangeCallback = modeChangeCallback;
        this._deleteCallback = deleteCallback;
    }

    reset(force = false) {
        // Toggle off polygon mode if active, similar to clicking the button
        if (this._draw.getMode() === 'polygon' || force) {
            this._draw.setMode('select');
            this._modeChangeCallback({ mode: 'simple_select' });
            if (this._polygonButton) {
                this._polygonButton.classList.remove('active');
            }
        }
    }

    deleteAll() {
        try {
            this._draw.clear();
            // Manually trigger deletion callback (MainMap expects this to clear selection)
            const dummyFeature = {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: [] }
            } as GeoJson.Feature<GeoJson.Polygon>;
            this._deleteCallback(dummyFeature);
            // Updating IDs will hide the trash button
            this.updateIds([]);
            // Also reset mode
            this.reset();
        } catch (e) {
            console.error('Error deleting features', e);
        }
    }

    onAdd(map: MapLibreGLMap): HTMLElement {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        // Polygon Button
        this._polygonButton = document.createElement('button');
        this._polygonButton.className = 'maplibregl-ctrl-icon terra-draw_ctrl-draw-btn';
        this._polygonButton.type = 'button';
        this._polygonButton.title = 'Polygon tool';
        // Flex center the icon
        this._polygonButton.style.display = 'flex';
        this._polygonButton.style.justifyContent = 'center';
        this._polygonButton.style.alignItems = 'center';

        const polygonRoot = createRoot(this._polygonButton);
        polygonRoot.render(React.createElement(FontAwesomeIcon, { icon: faDrawPolygon, style: { fontSize: '16px' } }));

        this._polygonButton.onclick = () => {
            if (this._draw.getMode() === 'polygon') {
                this.reset(true);
            } else {
                this._draw.setMode('polygon');
                this._modeChangeCallback({ mode: 'draw_polygon' });
                this._polygonButton.classList.add('active');
            }
        };
        this._container.appendChild(this._polygonButton);

        // Trash Button
        this._trashButton = document.createElement('button');
        this._trashButton.className = 'maplibregl-ctrl-icon terra-draw_ctrl-draw-btn';
        this._trashButton.type = 'button';
        this._trashButton.style.display = 'none'; // Hidden by default
        this._trashButton.style.justifyContent = 'center';
        this._trashButton.style.alignItems = 'center';
        this._trashButton.title = 'Delete';

        const trashRoot = createRoot(this._trashButton);
        trashRoot.render(React.createElement(FontAwesomeIcon, { icon: faTrashCan, style: { fontSize: '16px' } }));

        this._trashButton.onclick = () => {
            this.deleteAll();
        };
        this._container.appendChild(this._trashButton);

        return this._container;
    }

    onRemove() {
        this._container.parentNode?.removeChild(this._container);
        this._map = undefined;
    }

    updateIds(selectedIds: string[]) {
        // Toggle trash button visibility and polygon button state
        const hasFeatures = this._draw.getSnapshot().length > 0;

        if (selectedIds.length > 0 || hasFeatures) {
            this._trashButton.style.display = 'flex';
        } else {
            this._trashButton.style.display = 'none';
        }
    }
}

const cleanUpTerraDrawSources = (map: MapLibreGLMap) => {
    // Manually remove TerraDraw sources/layers if they were left behind
    const style = map.getStyle();
    if (!style) return;

    if (style.layers) {
        style.layers.forEach((layer) => {
            // TerraDraw usually prefixes with td- or terra-draw-
            // Error said "td-polygon"
            if (layer.id.startsWith('td-') || layer.id.startsWith('terra-draw')) {
                try {
                    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
                } catch (e) {
                    console.warn(`Failed to remove layer ${layer.id}`, e);
                }
            }
        });
    }

    if (style.sources) {
        Object.keys(style.sources).forEach((sourceId) => {
            if (sourceId.startsWith('td-') || sourceId.startsWith('terra-draw')) {
                try {
                    if (map.getSource(sourceId)) map.removeSource(sourceId);
                } catch (e) {
                    console.warn(`Failed to remove source ${sourceId}`, e);
                }
            }
        });
    }
};

const getTerraDraw = (
    map: MapLibreGLMap,
    modeChangeCallback: (p: { mode: string }) => void,
    createCallback: (p: GeoJson.Feature<GeoJson.Polygon | GeoJson.MultiPolygon> | GeoJson.FeatureCollection) => void,
    deleteCallback: (p: GeoJson.Feature<GeoJson.Polygon>) => void,
    _updateCallback?: (p: GeoJson.Feature<GeoJson.Polygon>) => void
): TerraDrawAdapter => {
    // Ensure any existing instance on this map is cleaned up first
    if (mapDrawInstances.has(map)) {
        console.log('Cleaning up existing TerraDraw instance on map before creating new one');
        const existingDraw = mapDrawInstances.get(map);
        if (existingDraw) {
            try {
                // Try stop() first
                existingDraw.stop();
            } catch (e) {
                console.error('Error stopping existing TerraDraw instance', e);
            }
        }
        const existingControl = mapControls.get(map);
        if (existingControl) {
            try {
                map.removeControl(existingControl);
            } catch (e) {
                console.error('Error removing existing TerraDraw control', e);
                // Ignore if already removed
            }
        }
        mapDrawInstances.delete(map);
        mapControls.delete(map);
    }

    // Force manual cleanup of sources/layers to prevent "Source already exists"
    cleanUpTerraDrawSources(map);

    // Initialize TerraDraw
    const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({
            map: map
        }),
        modes: [
            new TerraDrawSelectMode({
                flags: {
                    polygon: {
                        feature: {
                            draggable: true,
                            rotateable: true,
                            scaleable: true,
                            coordinates: {
                                midpoints: true,
                                draggable: true,
                                deletable: true
                            }
                        }
                    }
                },
                styles: {
                    selectedPolygonColor: '#ff9900',
                    selectedPolygonFillOpacity: 0.1,
                    selectedPolygonOutlineColor: '#ff9900',
                    selectedPolygonOutlineWidth: 2,
                    selectionPointColor: '#ff9900',
                    selectionPointWidth: 6, // Smaller nodes
                    selectionPointOutlineColor: '#ffffff',
                    selectionPointOutlineWidth: 2
                }
            }),
            new TerraDrawPolygonMode({
                styles: {
                    fillColor: '#ff9900',
                    fillOpacity: 0.1,
                    outlineColor: '#ff9900',
                    outlineWidth: 2,
                    closingPointColor: '#ff9900',
                    closingPointWidth: 6, // Smaller nodes
                    closingPointOutlineColor: '#ffffff',
                    closingPointOutlineWidth: 2,
                    coordinatePointColor: '#ff9900',
                    coordinatePointWidth: 6,
                    coordinatePointOutlineColor: '#ffffff',
                    coordinatePointOutlineWidth: 2
                }
            })
        ]
    });

    try {
        draw.start();
    } catch (e) {
        console.error('Error starting TerraDraw:', e);
        // If start fails, we might need to cleanup if it partially started
        cleanUpTerraDrawSources(map);
    }

    // Create custom control
    const control = new TerraDrawControl(draw, modeChangeCallback, deleteCallback);
    map.addControl(control, 'top-right');

    mapDrawInstances.set(map, draw);
    mapControls.set(map, control);

    const updateControl = () => {
        control.updateIds([]);
    };

    const getAggregateFeature = ():
        | GeoJson.Feature<GeoJson.Polygon | GeoJson.MultiPolygon>
        | GeoJson.FeatureCollection
        | null => {
        const snapshot = draw.getSnapshot() as GeoJson.Feature<GeoJson.Polygon>[];

        // Filter out invalid/incomplete polygons (e.g. drawing in progress or glitch)
        const validPolygons = snapshot.filter(
            (f) =>
                f.geometry &&
                f.geometry.coordinates &&
                f.geometry.coordinates.length > 0 &&
                f.geometry.coordinates[0].length >= 4
        );

        if (validPolygons.length === 0) return null;

        if (validPolygons.length === 1) {
            return validPolygons[0];
        }

        return {
            type: 'FeatureCollection',
            features: validPolygons
        };
    };

    // Event Listeners
    draw.on('change', () => {
        // Detect mode. If 'polygon', we are drawing. Don't spam createCallback which triggers full refresh/add/delete in MainMap.
        const mode = draw.getMode();

        if (mode === 'polygon') {
            return;
        }

        const feature = getAggregateFeature();

        if (feature) {
            createCallback(feature);
            updateControl();
        } else {
            // Only delete if there are truly no features in the snapshot
            // This prevents clearing selection if we have an "invalid" polygon state or transient state
            const snapshot = draw.getSnapshot();
            if (snapshot.length === 0) {
                const dummyFeature = {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Polygon', coordinates: [] }
                } as GeoJson.Feature<GeoJson.Polygon>;

                deleteCallback(dummyFeature);
                updateControl();
            }
        }
    });

    // Listen to finish event
    draw.on('finish' as any, () => {
        draw.setMode('polygon');

        // Update control button state - ensure it stays active
        if (control._polygonButton) {
            control._polygonButton.classList.add('active');
        }

        // Trigger creation immediately with the new aggregated set
        const feature = getAggregateFeature();
        if (feature) {
            createCallback(feature);
            updateControl();
        }
    });

    // Mock the TerraDrawAdapter interface expected by TransitionMainMap
    const drawWrapper: TerraDrawAdapter = {
        getAll: () => {
            const features = draw.getSnapshot();
            return {
                type: 'FeatureCollection',
                features: features
            } as GeoJson.FeatureCollection;
        },
        deleteAll: () => {
            // Use the control method to ensure specific cleanup logic (reset, UI update) is handled
            control.deleteAll();
            return drawWrapper;
        },
        add: (geojson) => {
            // Support adding features back to TerraDraw
            if (geojson.type === 'FeatureCollection') {
                draw.addFeatures(geojson.features as any);
                return geojson.features.map((f) => (f.id as string) || '');
            } else {
                draw.addFeatures([geojson as any]);
                return [(geojson.id as string) || ''];
            }
        },
        reset: () => {
            control.reset();
        },
        onRemove: () => {
            console.log('TerraDraw onRemove called via wrapper');
            try {
                draw.stop();
            } catch (e) {
                console.error('Error stopping TerraDraw', e);
            }
            try {
                map.removeControl(control);
            } catch (e) {
                console.error('Error removing TerraDraw control', e);
                // Control might already be removed
            }
            // Explicitly run cleanup too, just in case
            cleanUpTerraDrawSources(map);
            mapDrawInstances.delete(map);
            mapControls.delete(map);
        }
    };

    return drawWrapper;
};

const removeTerraDraw = (map: MapLibreGLMap, drawWrapper: TerraDrawAdapter): void => {
    // Try to remove using the wrapper callback
    if (drawWrapper && typeof drawWrapper.onRemove === 'function') {
        drawWrapper.onRemove();
    }

    // Explicitly check map instance map to ensure cleanup
    if (mapDrawInstances.has(map)) {
        console.log('Force cleaning up TerraDraw from map instance');
        const draw = mapDrawInstances.get(map);
        if (draw) {
            try {
                draw.stop();
            } catch (e) {
                console.error('Error stopping TerraDraw (force cleanup)', e);
            }
        }
        cleanUpTerraDrawSources(map);
        mapDrawInstances.delete(map);
        mapControls.delete(map);
    }
};

export { getTerraDraw, removeTerraDraw };
