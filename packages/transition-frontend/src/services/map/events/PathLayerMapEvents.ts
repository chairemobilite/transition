/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** This file encapsulates map events that apply to the path* layer, in any section */
import { Popup as MapLibrePopup } from 'maplibre-gl';
import type { MapLayerMouseEvent } from 'maplibre-gl';

import { MapEventHandlerDescription } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MapWithCustomEventsState } from 'chaire-lib-frontend/lib/services/map/MapWithCustomEventsState';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Path from 'transition-common/lib/services/path/Path';
import { addHoverClass, removeHoverClass } from '../MapCursorHelper';

const hoverPath = (pathId: string, coordinates: [number, number], pathName: string) => {
    const popup = new MapLibrePopup({
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

const onTransitPathSelectedMouseEnter = (e: MapLayerMouseEvent) => {
    if (e.features && e.features[0]) {
        addHoverClass();
    }
};

const onTransitPathSelectedMouseLeave = () => {
    removeHoverClass();
};

const onTransitPathWaypointMouseEnter = (e: MapLayerMouseEvent) => {
    if (e.features && e.features[0]) {
        addHoverClass();
    }
};

const onTransitPathWaypointMouseLeave = () => {
    removeHoverClass();
};

const onTransitPathWaypointSelectedMouseEnter = (e: MapLayerMouseEvent) => {
    if (e.features && e.features[0]) {
        addHoverClass();
    }
};

const onTransitPathWaypointSelectedMouseLeave = () => {
    removeHoverClass();
};

export const onTransitPathsMouseEnter = (e: MapLayerMouseEvent) => {
    if (e.target.getZoom() >= 12 && e.features && e.features[0]) {
        const pathGeojson = e.features[0];
        const hoveredPathId = pathGeojson.properties?.id;

        // Skip if hovering over the currently selected path - let transitPathsSelected handle it
        const selectedPath = serviceLocator.selectedObjectsManager?.getSingleSelection('path');
        if (selectedPath && selectedPath.getId() === hoveredPathId) {
            return;
        }

        // Skip hover on other paths when the selected path has unsaved changes
        // This prevents accidental path switching when editing
        const selectedLine = serviceLocator.selectedObjectsManager?.getSingleSelection('line');
        if (selectedPath && (selectedPath.hasChanged() || (selectedLine && selectedLine.hasChanged()))) {
            return;
        }

        const map = e.target as MapWithCustomEventsState;
        addHoverClass();
        const path = new Path(
            serviceLocator.collectionManager.get('paths').getById(hoveredPathId).properties,
            false,
            serviceLocator.collectionManager
        );
        const line = path.getLine();

        if (map._hoverPathIntegerId && map._hoverPathId && map._hoverPathSource) {
            unhoverPath(map._hoverPathId);
            map.setFeatureState(
                { source: map._hoverPathSource, id: map._hoverPathIntegerId },
                { size: 2, hover: false }
            );
        }

        map.setFeatureState({ source: pathGeojson.source, id: pathGeojson.id }, { size: 3, hover: true });

        // See https://github.com/alex3165/react-mapbox-gl/issues/506
        map._hoverPathIntegerId = pathGeojson.id;
        map._hoverPathId = hoveredPathId;
        map._hoverPathSource = pathGeojson.source;

        hoverPath(
            path.getId(),
            e.lngLat.toArray() as [number, number],
            `${line ? line.toString() : ''} • ${path.toString(false)} (${path.attributes.direction})`
        );

        e.originalEvent.stopPropagation();
    }
};

export const onTransitPathsMouseLeave = (e: MapLayerMouseEvent) => {
    const map = e.target as MapWithCustomEventsState;

    // Only decrement hover count if we have tracking state
    // (means we actually added hover in mouseenter, vs skipping for selected path)
    if (map._hoverPathIntegerId && map._hoverPathId && map._hoverPathSource) {
        removeHoverClass();
        unhoverPath(map._hoverPathId);
        e.target.setFeatureState(
            { source: map._hoverPathSource, id: map._hoverPathIntegerId },
            { size: 2, hover: false }
        );
        map._hoverPathIntegerId = null;
        map._hoverPathId = null;
        map._hoverPathSource = null;
    }
};

const pathLayerEventDescriptors: MapEventHandlerDescription[] = [
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
    {
        type: 'layer',
        layerName: 'transitPathWaypointsSelected',
        eventName: 'mouseenter',
        handler: onTransitPathWaypointSelectedMouseEnter
    },
    {
        type: 'layer',
        layerName: 'transitPathWaypointsSelected',
        eventName: 'mouseleave',
        handler: onTransitPathWaypointSelectedMouseLeave
    },
    { type: 'layer', layerName: 'transitPaths', eventName: 'mouseenter', handler: onTransitPathsMouseEnter },
    { type: 'layer', layerName: 'transitPaths', eventName: 'mouseleave', handler: onTransitPathsMouseLeave }
];

export default pathLayerEventDescriptors;
