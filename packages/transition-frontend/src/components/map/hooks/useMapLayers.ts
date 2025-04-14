/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Layer, LayerProps } from '@deck.gl/core';
import MapLayerManager from 'chaire-lib-frontend/lib/services/map/MapLayerManager';
import { MapCallbacks } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { MapEditTool } from '../types/TransitionMainMapTypes';
import getLayer from '../layers/TransitionMapLayer';
import { sectionLayers } from '../../../config/layers.config';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

export const useMapLayers = (
    layersConfig: any,
    mapCallbacks: MapCallbacks,
    mapEventsManager: any,
    activeSection: string,
    zoomRef: React.RefObject<number>,
    mapEditTool: MapEditTool | undefined,
    getEditToolLayers: (props: any) => Layer<LayerProps>[]
) => {
    const [layers, setLayers] = useState<Layer<LayerProps>[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // Create refs to store mutable values that shouldn't trigger function recreations
    const updateCountsRef = useRef<{ [layerName: string]: number }>({});
    const eventListenersRegistered = useRef(false);
    const activeSectionRef = useRef(activeSection);
    const mapEditToolRef = useRef(mapEditTool);
    const mapCallbacksRef = useRef(mapCallbacks);
    const mapEventsManagerRef = useRef(mapEventsManager);
    const getEditToolLayersRef = useRef(getEditToolLayers);

    // Update refs when props change
    useEffect(() => {
        activeSectionRef.current = activeSection;
    }, [activeSection]);

    useEffect(() => {
        mapEditToolRef.current = mapEditTool;
    }, [mapEditTool]);

    useEffect(() => {
        mapCallbacksRef.current = mapCallbacks;
    }, [mapCallbacks]);

    useEffect(() => {
        mapEventsManagerRef.current = mapEventsManager;
    }, [mapEventsManager]);

    useEffect(() => {
        getEditToolLayersRef.current = getEditToolLayers;
    }, [getEditToolLayers]);

    // Create the layer manager instance
    const layerManager = useMemo(() => {
        const manager = new MapLayerManager(layersConfig);
        // Register with service locator
        serviceLocator.addService('layerManager', manager);
        return manager;
    }, []);

    // Update map layers function with minimal dependencies
    const updateMapLayers = useCallback(() => {
        const deckGlLayers: Layer<LayerProps>[] = [];
        const enabledLayers = layerManager.getEnabledLayers().filter((layer) => layer.visible === true);

        enabledLayers.forEach((layer) => {
            const layerResult = getLayer({
                layerDescription: layer,
                zoom: zoomRef.current || 0,
                events:
                    mapEditToolRef.current === undefined
                        ? mapEventsManagerRef.current.getLayerEvents(layer.id)
                        : undefined,
                activeSection: activeSectionRef.current,
                setIsDragging,
                mapCallbacks: mapCallbacksRef.current,
                updateCount: updateCountsRef.current[layer.id] || 0,
                filter: layerManager.getFilter(layer.id)
            });

            if (layerResult) {
                if (Array.isArray(layerResult)) {
                    deckGlLayers.push(...layerResult.filter(Boolean));
                } else {
                    deckGlLayers.push(layerResult);
                }
            }
        });

        // Add edit layers if there's an active edit tool
        if (mapEditToolRef.current !== undefined) {
            const editToolLayers = getEditToolLayersRef.current({
                activeSection: activeSectionRef.current,
                setIsDragging,
                mapCallbacks: mapCallbacksRef.current
            });

            if (editToolLayers && editToolLayers.length > 0) {
                deckGlLayers.push(...editToolLayers);
            }
        }

        setLayers(deckGlLayers);
        return deckGlLayers;
    }, [zoomRef, setIsDragging]); // Only depends on zoomRef and setIsDragging now

    // Layer management functions (now with reduced dependencies by using updateMapLayersRef)
    const updateMapLayersRef = useRef(updateMapLayers);
    useEffect(() => {
        updateMapLayersRef.current = updateMapLayers;
    }, [updateMapLayers]);

    const showLayer = useCallback((layerName: string) => {
        layerManager.showLayer(layerName);
        updateMapLayersRef.current();
    }, []);

    const hideLayer = useCallback((layerName: string) => {
        layerManager.hideLayer(layerName);
        updateMapLayersRef.current();
    }, []);

    const clearFilter = useCallback((layerName: string) => {
        layerManager.clearFilter(layerName);
        updateMapLayersRef.current();
    }, []);

    const updateFilter = useCallback(
        (args: { layerName: string; filter: ((feature: GeoJSON.Feature) => 0 | 1) | undefined }) => {
            layerManager.updateFilter(args.layerName, args.filter);
            updateCountsRef.current[args.layerName] = (updateCountsRef.current[args.layerName] || 0) + 1;
            updateMapLayersRef.current();
        },
        []
    );

    const updateLayer = useCallback(
        (args: {
            layerName: string;
            data: GeoJSON.FeatureCollection | ((original: GeoJSON.FeatureCollection) => GeoJSON.FeatureCollection);
        }) => {
            layerManager.updateLayer(args.layerName, args.data);
            updateCountsRef.current[args.layerName] = (updateCountsRef.current[args.layerName] || 0) + 1;
            updateMapLayersRef.current();
        },
        []
    );

    const updateLayers = useCallback((geojsonByLayerName: any) => {
        layerManager.updateLayers(geojsonByLayerName);
        Object.keys(geojsonByLayerName).forEach(
            (layerName) => (updateCountsRef.current[layerName] = (updateCountsRef.current[layerName] || 0) + 1)
        );
        updateMapLayersRef.current();
    }, []);

    // Path filter functions
    const showPathsByAttribute = useCallback((attribute: string, value: any) => {
        const pathFilterManager = serviceLocator.getService('pathLayerManager');
        if (attribute === 'agency_id') {
            pathFilterManager.showAgencyId(value);
        } else if (attribute === 'line_id') {
            pathFilterManager.showLineId(value);
        }
        updateMapLayersRef.current();
    }, []);

    const hidePathsByAttribute = useCallback((attribute: string, value: any) => {
        const pathFilterManager = serviceLocator.getService('pathLayerManager');
        if (attribute === 'agency_id') {
            pathFilterManager.hideAgencyId(value);
        } else if (attribute === 'line_id') {
            pathFilterManager.hideLineId(value);
        }
        updateMapLayersRef.current();
    }, []);

    const clearPathsFilter = useCallback(() => {
        const pathFilterManager = serviceLocator.getService('pathLayerManager');
        pathFilterManager.clearFilter();
        updateMapLayersRef.current();
    }, []);

    // Handle section changes
    useEffect(() => {
        layerManager.updateEnabledLayers(sectionLayers[activeSection] || []);
        updateMapLayersRef.current();
    }, [activeSection]);

    // Update layers when edit tool changes
    useEffect(() => {
        updateMapLayersRef.current();
    }, [mapEditTool, getEditToolLayers]);

    // Update layers when zoom changes
    useEffect(() => {
        updateMapLayersRef.current();
    }, [zoomRef.current]);

    // Register event listeners
    useEffect(() => {
        if (eventListenersRegistered.current) {
            return;
        }

        // Set up layer-related event listeners
        serviceLocator.eventManager.on('map.updateLayer', updateLayer);
        serviceLocator.eventManager.on('map.updateLayers', updateLayers);
        serviceLocator.eventManager.on('map.layers.updateFilter', updateFilter);
        serviceLocator.eventManager.on('map.clearFilter', clearFilter);
        serviceLocator.eventManager.on('map.showLayer', showLayer);
        serviceLocator.eventManager.on('map.hideLayer', hideLayer);
        serviceLocator.eventManager.on('map.paths.byAttribute.show', showPathsByAttribute);
        serviceLocator.eventManager.on('map.paths.byAttribute.hide', hidePathsByAttribute);
        serviceLocator.eventManager.on('map.paths.clearFilter', clearPathsFilter);

        eventListenersRegistered.current = true;

        // Clean up event listeners on unmount
        return () => {
            if (eventListenersRegistered.current) {
                serviceLocator.eventManager.off('map.updateLayer', updateLayer);
                serviceLocator.eventManager.off('map.updateLayers', updateLayers);
                serviceLocator.eventManager.off('map.layers.updateFilter', updateFilter);
                serviceLocator.eventManager.off('map.clearFilter', clearFilter);
                serviceLocator.eventManager.off('map.showLayer', showLayer);
                serviceLocator.eventManager.off('map.hideLayer', hideLayer);
                serviceLocator.eventManager.off('map.paths.byAttribute.show', showPathsByAttribute);
                serviceLocator.eventManager.off('map.paths.byAttribute.hide', hidePathsByAttribute);
                serviceLocator.eventManager.off('map.paths.clearFilter', clearPathsFilter);

                // Remove the layer manager from service locator on unmount
                serviceLocator.removeService('layerManager');

                eventListenersRegistered.current = false;
            }
        };
    }, [
        updateLayer,
        updateLayers,
        updateFilter,
        clearFilter,
        showLayer,
        hideLayer,
        showPathsByAttribute,
        hidePathsByAttribute,
        clearPathsFilter
    ]);

    // Determine if animation is needed
    const needAnimation = useCallback(() => {
        if (Preferences.get('map.enableMapAnimations', true)) {
            return layerManager
                .getEnabledLayers()
                .filter((layer) => layer.visible === true)
                .some((layer) => layer.configuration.type === 'animatedArrowPath');
        }
        return false;
    }, []);

    // Only expose the layers and isDragging
    return {
        layers,
        isDragging,
        needAnimation
    };
};
