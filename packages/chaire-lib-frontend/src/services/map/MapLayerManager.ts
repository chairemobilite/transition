/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import maplibregl from 'maplibre-gl';
import { featureCollection as turfFeatureCollection } from '@turf/turf';
import _uniq from 'lodash/uniq';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

const defaultGeojson = turfFeatureCollection([]);

/**
 * Layer manager for MapLibre GL maps
 *
 * TODO See how filters are used and type them properly, make them map implementation independant ideally
 *
 * TODO: If we want to support multiple map implementation, this layer management will have to be updated
 */
class MaplibreLayerManager {
    private _map: maplibregl.Map | undefined;
    private _layersByName: { [key: string]: any } = {};
    private _enabledLayers: string[] = [];
    private _defaultFilterByLayer = {};
    private _filtersByLayer = {};

    constructor(layersConfig: any, map: maplibregl.Map | undefined = undefined) {
        this._map = map;

        for (const layerName in layersConfig) {
            const source = {
                type: 'geojson',
                data: defaultGeojson
            };

            const layer = layersConfig[layerName];
            layer.id = layerName;
            layer.source = layerName;

            if (layersConfig[layerName].layout) {
                layer.layout = layersConfig[layerName].layout;
            }
            if (layersConfig[layerName].defaultFilter) {
                layer.filter = layersConfig[layerName].defaultFilter;
                this._defaultFilterByLayer[layerName] = layersConfig[layerName].defaultFilter;
                this._filtersByLayer[layerName] = layersConfig[layerName].defaultFilter;
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
    setMap(map: maplibregl.Map) {
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

    updateFilter(layerName: string, filter: boolean | any[] | null | undefined) {
        if (this._defaultFilterByLayer[layerName]) {
            filter = ['all', this._defaultFilterByLayer[layerName], filter];
        }
        this._filtersByLayer[layerName] = filter;
        if (this.layerIsEnabled(layerName)) {
            this._map?.setFilter(layerName, this._filtersByLayer[layerName]);
        }
    }

    clearFilter(layerName: string) {
        this._filtersByLayer[layerName] = this._defaultFilterByLayer[layerName];
        if (this.layerIsEnabled(layerName)) {
            this._map?.setFilter(layerName, this._defaultFilterByLayer[layerName]);
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
                console.error('Layer not found, removing it', e);
                // Layer doesn't exist, which is fine
            }
            if (!enabledLayers.includes(previousEnabledLayer)) {
                // Try to remove source if it exists
                try {
                    if (this._map?.getSource(previousEnabledLayer)) {
                        this._map?.removeSource(previousEnabledLayer);
                    }
                } catch (e) {
                    console.error('Source not found, removing it', e);
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
            try {
                if (!this._map?.getSource(enabledLayer)) {
                    this._map?.addSource(enabledLayer, this._layersByName[enabledLayer].source);
                }
            } catch (e) {
                console.error('Source not found, adding it', e);
                // Source doesn't exist, add it
                this._map?.addSource(enabledLayer, this._layersByName[enabledLayer].source);
            }
            // Check if layer exists before adding
            try {
                if (!this._map?.getLayer(enabledLayer)) {
                    this._map?.addLayer(this._layersByName[enabledLayer].layer);
                }
            } catch (e) {
                console.error('Layer not found, adding it', e);
                // Layer doesn't exist, add it
                this._map?.addLayer(this._layersByName[enabledLayer].layer);
            }
            this._map?.setFilter(enabledLayer, this._filtersByLayer[enabledLayer]);
            enabledAndActiveLayers.push(enabledLayer);
        });
        this._enabledLayers = enabledAndActiveLayers;
        serviceLocator.eventManager.emit('map.updatedEnabledLayers', enabledLayers);
    }

    showLayerObjectByAttribute(layerName: string, attribute: string, value: any) {
        const existingFilter = this.getFilter(layerName);
        let values: any[] = [];
        if (
            existingFilter &&
            existingFilter[0] === 'match' &&
            existingFilter[1] &&
            existingFilter[1][0] === 'get' &&
            existingFilter[1][1] === attribute
        ) {
            if (existingFilter[2] && !existingFilter[2].includes(value)) {
                values = existingFilter[2];
                values.push(value);
            } else {
                values = [value];
            }
            existingFilter[2] = values;
            this._map?.setFilter(layerName, existingFilter);
        } else {
            this._map?.setFilter(layerName, ['match', ['get', attribute], values, true, false]);
        }
    }

    hideLayerObjectByAttribute(layerName, attribute, value) {
        const existingFilter = this.getFilter(layerName);
        let values: any[] = [];
        if (
            existingFilter &&
            existingFilter[0] === 'match' &&
            existingFilter[1] &&
            existingFilter[1][0] === 'get' &&
            existingFilter[1][1] === attribute
        ) {
            if (existingFilter[2]) {
                values = existingFilter[2];
                const valueIndex = values.indexOf(value);
                if (valueIndex < 0) {
                    values.push(value);
                }
            } else {
                values = [value];
            }
            existingFilter[2] = values;
            this._map?.setFilter(layerName, existingFilter);
        } else {
            this._map?.setFilter(layerName, ['match', ['get', attribute], values, true, false]);
        }
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

    updateLayerShader(layerName, newShaderName, repaint = false) {
        if (!layerName || !this._layersByName[layerName]) {
            console.error('layerName is empty or does not exist');
            return null;
        }
        if (!newShaderName) {
            console.error('newShaderName is undefined or empty');
            return null;
        }
        this._layersByName[layerName].layer['custom-shader'] = newShaderName;
        this._map?.removeLayer(layerName);
        if (this._map && repaint === true) {
            this._map.repaint = true;
        }
        this._map?.addLayer(this._layersByName[layerName].layer, this.getNextLayerName(layerName));
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
            (this._map.getSource(layerName) as maplibregl.GeoJSONSource).setData(
                this._layersByName[layerName].source.data
            );
            if (this._layersByName[layerName].layer.repaint === true) {
                // activate repaint for animated shaders:
                this._map.repaint = newGeojson.features && newGeojson.features.length > 0;
            }
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
                (this._map.getSource(layerName) as maplibregl.GeoJSONSource).setData(
                    this._layersByName[layerName].source.data
                );
                if (this._layersByName[layerName].layer.repaint === true) {
                    // activate repaint for animated shaders:
                    this._map.repaint = newGeojson.features && newGeojson.features.length > 0;
                }
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

export default MaplibreLayerManager;
