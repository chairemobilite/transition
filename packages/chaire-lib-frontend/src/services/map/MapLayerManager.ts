/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Map as MapLibreMap, FilterSpecification, LayerSpecification, GeoJSONSourceSpecification } from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { featureCollection as turfFeatureCollection } from '@turf/turf';
import _uniq from 'lodash/uniq';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

const defaultGeojson = turfFeatureCollection([]);

/**
 * Input configuration for a layer, before processing by the constructor.
 * Uses Record types to accept plain object literals without strict type checking.
 * MapLibre validates these at runtime. Callers must narrow `unknown` values before use.
 */
export type LayerInputConfig = Record<string, unknown> & {
    type: string;
    /** Default filter for the layer; accepts loose array types (validated by MapLibre at runtime) */
    defaultFilter?: FilterSpecification | readonly unknown[];
};

/**
 * Processed layer entry stored in _layersByName, containing the
 * MapLibre layer specification and its associated GeoJSON source.
 */
type LayerEntry = {
    layer: LayerSpecification;
    source: GeoJSONSourceSpecification & {
        /** Override data type to be FeatureCollection for runtime access */
        data: GeoJSON.FeatureCollection;
    };
};

/** MapLibre filter type */
type LayerFilter = FilterSpecification | null | undefined;

/**
 * Layer manager for MapLibre GL maps
 *
 * TODO See how filters are used and type them properly, make them map implementation independant ideally
 *
 * TODO: If we want to support multiple map implementation, this layer management will have to be updated
 */
class MapLibreLayerManager {
    private _map: MapLibreMap | undefined;
    private _layersByName: Record<string, LayerEntry> = {};
    private _enabledLayers: string[] = [];
    private _defaultFilterByLayer: Record<string, LayerFilter> = {};
    private _filtersByLayer: Record<string, LayerFilter> = {};

    constructor(layersConfig: Record<string, LayerInputConfig>, map: MapLibreMap | undefined = undefined) {
        this._map = map;

        for (const layerName in layersConfig) {
            const source: LayerEntry['source'] = {
                type: 'geojson',
                data: defaultGeojson
            };

            const inputConfig = layersConfig[layerName];
            const { defaultFilter, ...layerProps } = inputConfig;

            // Build the layer specification with required id and source
            const layer = {
                ...layerProps,
                id: layerName,
                source: layerName,
                ...(defaultFilter ? { filter: defaultFilter } : {})
            } as LayerSpecification;

            if (defaultFilter) {
                this._defaultFilterByLayer[layerName] = defaultFilter as FilterSpecification;
                this._filtersByLayer[layerName] = defaultFilter as FilterSpecification;
            } else {
                this._filtersByLayer[layerName] = undefined;
                this._defaultFilterByLayer[layerName] = undefined;
            }

            this._layersByName[layerName] = {
                layer,
                source
            };
        }
    }

    // TODO Consider deprecating and adding the map on the constructor only
    setMap(map: MapLibreMap) {
        this._map = map;
    }

    showLayer(layerName: string) {
        this._map?.setLayoutProperty(layerName, 'visibility', 'visible');
    }

    hideLayer(layerName: string) {
        this._map?.setLayoutProperty(layerName, 'visibility', 'none');
    }

    getFilter(layerName: string) {
        return this._filtersByLayer[layerName] || null;
    }

    updateFilter(layerName: string, filter: LayerFilter) {
        const defaultFilter = this._defaultFilterByLayer[layerName];
        if (defaultFilter && filter) {
            // Combine with default filter using 'all' expression
            filter = ['all', defaultFilter, filter] as FilterSpecification;
        } else if (defaultFilter) {
            filter = defaultFilter;
        }
        this._filtersByLayer[layerName] = filter;
        if (this.layerIsEnabled(layerName)) {
            // Use nullish coalescing to pass null instead of undefined to MapLibre
            this._map?.setFilter(layerName, (this._filtersByLayer[layerName] ?? null) as FilterSpecification | null);
        }
    }

    clearFilter(layerName: string) {
        this._filtersByLayer[layerName] = this._defaultFilterByLayer[layerName];
        if (this.layerIsEnabled(layerName)) {
            this._map?.setFilter(
                layerName,
                (this._defaultFilterByLayer[layerName] ?? null) as FilterSpecification | null
            );
        }
    }

    updateEnabledLayers(enabledLayers: string[] = []) {
        if (!this._map) {
            return;
        }
        enabledLayers = _uniq(enabledLayers); // make sure we do not have the same layer twice (can happen with user prefs not replaced correctly after updates)
        const previousEnabledLayers: string[] = this._enabledLayers || [];
        previousEnabledLayers.forEach((previousEnabledLayer) => {
            // Try to remove layer if it exists (it might have been removed by style change)
            try {
                if (this._map?.getLayer(previousEnabledLayer)) {
                    this._map?.removeLayer(previousEnabledLayer);
                }
            } catch (e) {
                console.error('Layer not found, ignoring it', e);
                // Layer doesn't exist, which is fine
            }
            if (!enabledLayers.includes(previousEnabledLayer)) {
                // Try to remove source if it exists
                try {
                    if (this._map?.getSource(previousEnabledLayer)) {
                        this._map?.removeSource(previousEnabledLayer);
                    }
                } catch (e) {
                    console.error('Source not found, ignoring it', e);
                    // Source doesn't exist, which is fine
                }
            }
        });
        const enabledAndActiveLayers: string[] = [];
        enabledLayers.forEach((enabledLayer) => {
            if (!this._layersByName[enabledLayer]) {
                // Layer not defined
                return;
            }
            // Check if source exists on the map (it might have been removed by style change)
            // If it doesn't exist, add it
            if (!this._map?.getSource(enabledLayer)) {
                this._map?.addSource(enabledLayer, this._layersByName[enabledLayer].source);
            }
            // Check if layer exists before adding
            if (!this._map?.getLayer(enabledLayer)) {
                this._map?.addLayer(this._layersByName[enabledLayer].layer);
            }
            this._map?.setFilter(
                enabledLayer,
                (this._filtersByLayer[enabledLayer] ?? null) as FilterSpecification | null
            );
            enabledAndActiveLayers.push(enabledLayer);
        });
        this._enabledLayers = enabledAndActiveLayers;
        // Note: map.repaint is now managed by DeckGLControl component
        serviceLocator.eventManager.emit('map.updatedEnabledLayers', enabledLayers);
    }

    showLayerObjectByAttribute(layerName: string, attribute: string, value: string | number) {
        const existingFilter = this.getFilter(layerName);
        let values: (string | number)[] = [];
        let newFilter: FilterSpecification;

        if (
            existingFilter &&
            existingFilter[0] === 'match' &&
            existingFilter[1] &&
            existingFilter[1][0] === 'get' &&
            existingFilter[1][1] === attribute
        ) {
            const filterValues = existingFilter[2];
            if (filterValues && Array.isArray(filterValues)) {
                if ((filterValues as (string | number)[]).includes(value)) {
                    // Value already exists, preserve existing filter values (no change needed)
                    return;
                } else {
                    // Clone existing values and add the new value
                    values = [...(filterValues as (string | number)[])];
                    values.push(value);
                }
            } else {
                values = [value];
            }
            existingFilter[2] = values as string[] | number[];
            newFilter = existingFilter as FilterSpecification;
        } else {
            // Initialize with [value] so the filter matches the specified value
            newFilter = ['match', ['get', attribute], [value], true, false] as FilterSpecification;
        }

        // Update both map and internal cache
        this._map?.setFilter(layerName, newFilter);
        this._filtersByLayer[layerName] = newFilter;
    }

    hideLayerObjectByAttribute(layerName: string, attribute: string, value: string | number) {
        const existingFilter = this.getFilter(layerName);
        if (
            existingFilter &&
            existingFilter[0] === 'match' &&
            existingFilter[1] &&
            existingFilter[1][0] === 'get' &&
            existingFilter[1][1] === attribute
        ) {
            if (existingFilter[2] && Array.isArray(existingFilter[2])) {
                const values = existingFilter[2] as (string | number)[];
                const valueIndex = values.indexOf(value);
                if (valueIndex >= 0) {
                    // Remove the value from the filter
                    values.splice(valueIndex, 1);
                    if (values.length === 0) {
                        // No more values to match, clear the filter
                        this._map?.setFilter(layerName, null);
                        this._filtersByLayer[layerName] = null;
                    } else {
                        existingFilter[2] = values as string[] | number[];
                        const newFilter = existingFilter as FilterSpecification;
                        this._map?.setFilter(layerName, newFilter);
                        this._filtersByLayer[layerName] = newFilter;
                    }
                }
            }
        }
        // If no existing match filter for this attribute, nothing to hide
    }

    getLayer(layerName: string) {
        return this._map?.getLayer(layerName);
    }

    getNextLayerName(layerName: string) {
        // to be able to add a layer before another (see maplibre map.addLayer attribute beforeId)
        const enabledLayers = this._enabledLayers || [];
        const enabledLayersCount = enabledLayers.length;
        for (let i = 0; i < enabledLayersCount - 1; i++) {
            //  return undefined is already last (i < length - 1)
            const enabledLayerName = this._enabledLayers[i];
            if (enabledLayerName === layerName) {
                return this._enabledLayers[i + 1];
            }
        }
        return undefined;
    }

    updateLayer(
        layerName: string,
        geojson: GeoJSON.FeatureCollection | ((original: GeoJSON.FeatureCollection) => GeoJSON.FeatureCollection)
    ) {
        const newGeojson =
            typeof geojson === 'function'
                ? geojson(this._layersByName[layerName].source.data)
                : geojson
                    ? geojson
                    : defaultGeojson;
        this._layersByName[layerName].source.data = newGeojson;

        if (this._map && this.layerIsEnabled(layerName)) {
            (this._map.getSource(layerName) as GeoJSONSource).setData(this._layersByName[layerName].source.data);
        }
        serviceLocator.eventManager.emit('map.updatedLayer', layerName);
    }

    updateLayers(geojsonByLayerName) {
        for (const layerName in geojsonByLayerName) {
            const geojson = geojsonByLayerName[layerName];
            const newGeojson =
                typeof geojson === 'function'
                    ? geojson(this._layersByName[layerName].source.data)
                    : geojson
                        ? geojson
                        : defaultGeojson;
            this._layersByName[layerName].source.data = newGeojson;
            if (this._map && this.layerIsEnabled(layerName)) {
                (this._map.getSource(layerName) as GeoJSONSource).setData(this._layersByName[layerName].source.data);
            }
        }
        serviceLocator.eventManager.emit('map.updatedLayers', Object.keys(geojsonByLayerName));
    }

    layerIsEnabled(layerName: string) {
        return this.getEnabledLayers().includes(layerName);
    }

    layerIsVisible(layerName: string) {
        if (!this._map) {
            return null;
        }
        const layerVisibility = this._map.getLayoutProperty(layerName, 'visibility');
        return layerVisibility === 'visible' || layerVisibility === undefined;
    }

    getEnabledLayers() {
        return this._enabledLayers;
    }

    getLayerNames() {
        return Object.keys(this._layersByName);
    }

    getLayerConfig(layerName: string) {
        return this._layersByName[layerName];
    }
}

export default MapLibreLayerManager;
