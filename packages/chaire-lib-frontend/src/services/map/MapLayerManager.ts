/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { featureCollection as turfFeatureCollection } from '@turf/turf';
import _uniq from 'lodash/uniq';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { MapLayer } from './layers/LayerDescription';

const defaultGeojson = turfFeatureCollection([]) as GeoJSON.FeatureCollection<GeoJSON.Geometry>;

/**
 * Layer manager for Mapbox-gl maps
 *
 * TODO: If we want to support multiple map implementation, this layer management will have to be updated
 */
class MapLayerManager {
    private _layersByName: { [key: string]: MapLayer } = {};
    private _enabledLayers: string[] = [];
    private _filtersByLayer: {
        [layerName: string]: ((feature: GeoJSON.Feature) => 0 | 1) | undefined;
    } = {};

    constructor(layersConfig: any) {
        for (const layerName in layersConfig) {
            this._layersByName[layerName] = {
                id: layerName,
                visible: false,
                configuration: layersConfig[layerName],
                layerData: defaultGeojson
            };
            this._enabledLayers = [];
        }
    }

    showLayer(layerName: string) {
        if (this._layersByName[layerName] !== undefined) {
            this._layersByName[layerName].visible = true;
        }
    }

    hideLayer(layerName: string) {
        if (this._layersByName[layerName] !== undefined) {
            this._layersByName[layerName].visible = false;
        }
    }

    getFilter(layerName: string): ((feature: GeoJSON.Feature) => 0 | 1) | undefined {
        return this._filtersByLayer[layerName];
    }

    updateFilter(layerName: string, filter: ((feature: GeoJSON.Feature) => 0 | 1) | undefined) {
        if (filter === undefined) {
            delete this._filtersByLayer[layerName];
        } else {
            this._filtersByLayer[layerName] = filter;
        }
    }

    clearFilter(layerName: string) {
        delete this._filtersByLayer[layerName];
    }

    updateEnabledLayers(enabledLayers: string[] = []) {
        this._enabledLayers = _uniq(enabledLayers).filter((layerName) => this._layersByName[layerName] !== undefined); // make sure we do not have the same layer twice (can happen with user prefs not replaced correctly after updates)
        serviceLocator.eventManager.emit('map.updatedEnabledLayers', this._enabledLayers);
    }

    getLayer(layerName: string) {
        return this._layersByName[layerName];
    }

    getNextLayerName(_layerName: string) {
        // to be able to add a layer before another (see mapbox map.addLayer attribute beforeId)
        /*   const enabledLayers = this._enabledLayers || [];
        const enabledLayersCount = enabledLayers.length;
        for (let i = 0; i < enabledLayersCount - 1; i++) {
            //  return undefined is already last (i < length - 1)
            const enabledLayerName = this._enabledLayers[i];
            if (enabledLayerName === layerName) {
                return this._enabledLayers[i + 1];
            }
        } */
        return undefined;
    }

    updateLayerShader(layerName, newShaderName, _repaint = false) {
        if (!layerName || !this._layersByName[layerName]) {
            console.error('layerName is empty or does not exist');
            return null;
        }
        if (!newShaderName) {
            console.error('newShaderName is undefined or empty');
            return null;
        }
        // TODO Re-implement this
        /* this._layersByName[layerName].layer['custom-shader'] = newShaderName;
        this._map?.removeLayer(layerName);
        if (this._map && repaint === true) {
            this._map.repaint = true;
        }
        this._map?.addLayer(this._layersByName[layerName].layer, this.getNextLayerName(layerName)); */
    }

    updateLayer(
        layerName: string,
        geojson: GeoJSON.FeatureCollection | ((original: GeoJSON.FeatureCollection) => GeoJSON.FeatureCollection)
    ) {
        // FIXME: In original code, geojson can be a function. Do we need to support this? It took the source data as parameter
        if (this._layersByName[layerName] !== undefined) {
            const geojsonData =
                typeof geojson === 'function' ? geojson(this._layersByName[layerName].layerData) : geojson;
            this._layersByName[layerName].layerData = geojsonData;
        } else {
            console.log('layer does not exist', layerName);
        }
    }

    updateLayers(geojsonByLayerName) {
        for (const layerName in geojsonByLayerName) {
            if (this._layersByName[layerName] !== undefined) {
                this._layersByName[layerName].layerData = geojsonByLayerName[layerName];
                if (this._layersByName[layerName].visible && this._enabledLayers.includes(layerName)) {
                    serviceLocator.eventManager.emit('map.updatedLayer', layerName);
                }
            } else {
                console.log('layer does not exist', layerName);
            }
        }
        serviceLocator.eventManager.emit('map.updatedLayers', Object.keys(geojsonByLayerName));
    }

    layerIsEnabled(layerName: string) {
        return this._enabledLayers.includes(layerName);
    }

    layerIsVisible(layerName: string) {
        return this._layersByName[layerName]?.visible;
    }

    getEnabledLayers(): MapLayer[] {
        return this._enabledLayers
            .filter((layerName) => this._layersByName[layerName].layerData.features.length > 0)
            .map((layerName) => this._layersByName[layerName]);
    }

    getLayerNames() {
        return Object.keys(this._layersByName);
    }

    getLayerConfig(layerName: string) {
        return this._layersByName[layerName];
    }
}

export default MapLayerManager;
