/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import type { CustomLayerInterface } from 'maplibre-gl';
import type { Feature } from 'geojson';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

/** Custom layer drawing GeoJSON features with an optional animation */
export interface AnimatedCustomLayer extends CustomLayerInterface {
    setData(features: Feature[]): void;
    setAnimationEnabled(enabled: boolean): void;
}

export interface CustomLayerControlProps {
    /** Create the layer. Called once, when the control mounts. */
    createLayer: (disableAnimation: boolean) => AnimatedCustomLayer;
    /** MapLibre layer to draw this layer under. If it is not on the map, the layer is drawn on top. */
    beforeId?: string;
    /** Features to draw */
    features: Feature[];
    /** Freeze the animation, without continuous repaint */
    disableAnimation: boolean;
}

/**
 * Add a custom layer to the map, keep it at its position in the layer order, and keep its data
 * and animation state in sync with the props.
 */
const CustomLayerControl: React.FC<CustomLayerControlProps> = ({
    createLayer,
    beforeId,
    features,
    disableAnimation
}) => {
    const { current: mapRef } = useMap();
    const layerRef = useRef<AnimatedCustomLayer | null>(null);
    layerRef.current ??= createLayer(disableAnimation);

    useEffect(() => {
        const map = mapRef?.getMap();
        const layer = layerRef.current;
        if (!map || !layer) {
            return;
        }
        // The layer manager removes and adds all its layers when the section or the style changes,
        // which leaves the custom layer out of place, or removes it with the previous style.
        const placeLayer = (): void => {
            const validBeforeId = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
            if (map.getLayer(layer.id)) {
                map.moveLayer(layer.id, validBeforeId);
            } else {
                map.addLayer(layer, validBeforeId);
            }
        };
        placeLayer();
        serviceLocator.eventManager.on('map.updatedEnabledLayers', placeLayer);
        return () => {
            serviceLocator.eventManager.off('map.updatedEnabledLayers', placeLayer);
            if (map.style && map.getLayer(layer.id)) {
                map.removeLayer(layer.id);
            }
        };
    }, [mapRef, beforeId]);

    useEffect(() => {
        layerRef.current?.setData(features);
    }, [features]);

    useEffect(() => {
        layerRef.current?.setAnimationEnabled(!disableAnimation);
    }, [disableAnimation]);

    return null;
};

export default CustomLayerControl;
