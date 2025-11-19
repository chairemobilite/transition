/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the path* layer, in any section */
import maplibregl from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Path from 'transition-common/lib/services/path/Path';

const hoverPath = (pathId: string, coordinates: [number, number], pathName: string) => {
    const popup = new maplibregl.Popup({
        offset: 10,
        anchor: 'bottom'
    });
    popup.setLngLat(coordinates);
    popup.setHTML(`<p>${pathName}</p>`);
    serviceLocator.eventManager.emit('map.addPopup', pathId, popup);
};

export const unhoverPath = (pathId: string) => {
    serviceLocator.eventManager.emit('map.removePopup', pathId);
};

const onTransitPathSelectedMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.features && e.features[0]) {
        e.target.getCanvas().style.cursor = 'pointer';
    }
};

const onTransitPathSelectedMouseLeave = (e: maplibregl.MapLayerMouseEvent) => {
    e.target.getCanvas().style.cursor = '';
};

const onTransitPathWaypointMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.features && e.features[0]) {
        e.target.getCanvas().style.cursor = 'pointer';
    }
};

const onTransitPathWaypointMouseLeave = (e: maplibregl.MapLayerMouseEvent) => {
    e.target.getCanvas().style.cursor = '';
};

export const onTransitPathsMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
    if (e.target.getZoom() >= 12 && e.features && e.features[0]) {
        const map = e.target as any;
        e.target.getCanvas().style.cursor = 'pointer';
        const pathGeojson = e.features[0];
        const path = new Path(
            serviceLocator.collectionManager.get('paths').getById(pathGeojson.properties?.id).properties,
            false,
            serviceLocator.collectionManager
        );
        const line = path.getLine();

        if (map._hoverPathIntegerId) {
            unhoverPath(map._hoverPathId);
            e.target.setFeatureState(
                { source: map._hoverPathSource, id: map._hoverPathIntegerId },
                { size: 2, hover: false }
            );
        }

        e.target.setFeatureState({ source: pathGeojson.source, id: pathGeojson.id }, { size: 3, hover: true });

        // See https://github.com/alex3165/react-mapbox-gl/issues/506
        map._hoverPathIntegerId = pathGeojson.id;
        map._hoverPathId = pathGeojson.properties?.id;
        map._hoverPathSource = pathGeojson.source;

        hoverPath(
            path.getId(),
            e.lngLat.toArray() as [number, number],
            `${line ? line.toString() : ''} • ${path.toString(false)} (${path.attributes.direction})`
        );

        e.originalEvent.stopPropagation();
    }
};

export const onTransitPathsMouseLeave = (e: maplibregl.MapLayerMouseEvent) => {
    e.target.getCanvas().style.cursor = '';

    const map = e.target as any;

    if (map._hoverPathIntegerId) {
        unhoverPath(map._hoverPathId);
        e.target.setFeatureState(
            { source: map._hoverPathSource, id: map._hoverPathIntegerId },
            { size: 2, hover: false }
        );
    }

    map._hoverPathIntegerId = null;
    map._hoverPathId = null;
    map._hoverPathSource = null;
};

const nodeLayerEventDescriptors: MapEventHandlerDescription[] = [
    {
        type: 'layer',
        layerName: 'transitPathsSelected',
        eventName: 'mouseenter',
        handler: onTransitPathSelectedMouseEnter
    },
    {
        type: 'layer',
        layerName: 'transitPathsSelected',
        eventName: 'mouseleave',
        handler: onTransitPathSelectedMouseLeave
    },
    {
        type: 'layer',
        layerName: 'transitPathWaypoints',
        eventName: 'mouseenter',
        handler: onTransitPathWaypointMouseEnter
    },
    {
        type: 'layer',
        layerName: 'transitPathWaypoints',
        eventName: 'mouseleave',
        handler: onTransitPathWaypointMouseLeave
    },
    { type: 'layer', layerName: 'transitPaths', eventName: 'mouseenter', handler: onTransitPathsMouseEnter },
    { type: 'layer', layerName: 'transitPaths', eventName: 'mouseleave', handler: onTransitPathsMouseLeave }
];

export default nodeLayerEventDescriptors;
