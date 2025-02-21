/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { Layer, LayerProps } from '@deck.gl/core';
import { MjolnirEvent } from 'mjolnir.js';
import { point as turfPoint, featureCollection as turfFeatureCollection, polygon, lineString } from '@turf/turf';

import { MapEventHandlerDescriptor, PointInfo } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import getLayer, { TransitionMapLayerProps } from '../layers/TransitionMapLayer';
import { MapEditFeature } from '../MapEditFeature';
import { LayerConfiguration } from 'chaire-lib-frontend/lib/services/map/layers/LayerDescription';

const layers: { [layerName: string]: LayerConfiguration } = {
    polygonBuilderPolygon: {
        type: 'fill' as const,
        color: '#eba134',
        lineColor: '#eba134',
        lineWidth: 4,
        opacity: 0.05,
        pickable: false
    },

    polygonBuilderLine: {
        type: 'line' as const,
        color: '#eba134',
        lineColor: '#eba134',
        widthUnits: 'pixels' as const,
        widthScale: 1,
        opacity: 0.05,
        widthMinPixels: 2,
        capRounded: true,
        jointRounded: true
    },

    polygonBuilderPoints: {
        type: 'circle' as const,
        radiusUnits: 'pixels' as const,
        strokeColor: [255, 255, 255] as [number, number, number],
        strokeWidth: 2,
        fillColor: '#eba134',
        radius: 4,
        radiusScale: 1,
        lineWidthScale: 1,
        lineWidthUnits: 'pixels' as const
    }
};

class PolygonBuilder {
    private points: GeoJSON.Feature<GeoJSON.Point>[] = [];
    private tempPoint: GeoJSON.Feature<GeoJSON.Point> | null = null;
    private isComplete = false;

    addPoint(point: GeoJSON.Feature<GeoJSON.Point>) {
        this.points.push(point);
    }

    setTempPoint(point: GeoJSON.Feature<GeoJSON.Point>) {
        this.tempPoint = point;
    }

    getPolygonOrLineFeature(): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.LineString> | null {
        if ((this.tempPoint === null && this.points.length < 2) || (this.tempPoint && this.points.length < 1)) {
            return null;
        }

        const coordinates = this.points.map((point) => point.geometry.coordinates);
        if (this.tempPoint) {
            coordinates.push(this.tempPoint.geometry.coordinates);
        }
        // This is a polygon, so we close it by adding the first point at the end
        if (coordinates.length > 2) {
            // Close the polygon by adding the first point at the end
            coordinates.push(coordinates[0]);

            return polygon([coordinates]);
        }
        return lineString(coordinates);
    }

    getPoints(): GeoJSON.Feature<GeoJSON.Point>[] {
        return this.points;
    }

    closePolygon() {
        this.isComplete = true;
    }

    isPolygonComplete() {
        return this.isComplete;
    }
}

export class PolygonDrawMapFeature implements MapEditFeature {
    static editMode = 'polygonDraw';

    private _polygonBuilder: PolygonBuilder = new PolygonBuilder();
    private _events: MapEventHandlerDescriptor[] = [];

    constructor(
        private _callbacks: {
            onUpdate: () => void;
            onDisable: () => void;
        }
    ) {
        /* Nothing to do */
        this._events = [
            {
                type: 'map',
                eventName: 'onLeftClick',
                handler: this.onMapClicked
            },
            {
                type: 'map',
                eventName: 'onRightClick',
                handler: this.onMapRightClicked
            },
            {
                type: 'map',
                eventName: 'onPointerMove',
                handler: this.onPointerMove
            },
            {
                type: 'map',
                eventName: 'onLeftDblClick',
                handler: this.onDoubleClick
            }
        ];
    }

    private onMapClicked = (pointInfo: PointInfo, _event: MjolnirEvent) => {
        if (this._polygonBuilder.isPolygonComplete()) {
            this._polygonBuilder = new PolygonBuilder();
        }
        this._polygonBuilder.addPoint(turfPoint(pointInfo.coordinates as [number, number]));
        this._callbacks.onUpdate();
        return true;
    };

    private onMapRightClicked = (_pointInfo: PointInfo, _event: MjolnirEvent) => {
        // Disable the tool
        this._callbacks.onDisable();
        return true;
    };

    private onPointerMove = (pointInfo: PointInfo, _event: MjolnirEvent) => {
        if (this._polygonBuilder.isPolygonComplete()) {
            return false;
        }
        this._polygonBuilder.setTempPoint(turfPoint(pointInfo.coordinates as [number, number]));
        this._callbacks.onUpdate();
        return true;
    };

    private onDoubleClick = (_pointInfo: PointInfo, _event: MjolnirEvent) => {
        this._polygonBuilder.closePolygon();
        const polygonOrLineFeature = this._polygonBuilder.getPolygonOrLineFeature();
        if (polygonOrLineFeature?.geometry.type === 'Polygon') {
            // Emit an event with the polygon in a feature collection
            serviceLocator.eventManager.emit('map.draw.polygon', {
                polygons: turfFeatureCollection([polygonOrLineFeature])
            });
        }
        this._callbacks.onDisable();
        return true;
    };

    getEditMode = () => PolygonDrawMapFeature.editMode;
    getMapEvents = () => this._events;
    getLayers = (props: Omit<TransitionMapLayerProps, 'layerDescription' | 'events'>) => {
        const mapLayers: Layer<LayerProps>[] = [];
        const polygonFeature = this._polygonBuilder.getPolygonOrLineFeature();
        if (polygonFeature && polygonFeature.geometry.type === 'Polygon') {
            const lineLayers = getLayer({
                ...props,
                layerDescription: {
                    id: 'polygonBuilderPolygon',
                    visible: true,
                    configuration: layers.polygonBuilderPolygon,
                    layerData: turfFeatureCollection([polygonFeature])
                }
            });
            if (lineLayers) {
                mapLayers.push(...lineLayers);
            }
        } else if (polygonFeature && polygonFeature.geometry.type === 'LineString') {
            const lineLayers = getLayer({
                ...props,
                layerDescription: {
                    id: 'polygonBuilderLine',
                    visible: true,
                    configuration: layers.polygonBuilderLine,
                    layerData: turfFeatureCollection([polygonFeature])
                }
            });
            if (lineLayers) {
                mapLayers.push(...lineLayers);
            }
        }

        const pointFeatureCollection = _cloneDeep(this._polygonBuilder.getPoints());
        if (pointFeatureCollection.length > 0) {
            const pointLayers = getLayer({
                ...props,
                layerDescription: {
                    id: 'polygonBuilderPoints',
                    visible: true,
                    configuration: layers.polygonBuilderPoints,
                    layerData: turfFeatureCollection(pointFeatureCollection)
                }
            });
            if (pointLayers) {
                mapLayers.push(...pointLayers);
            }
        }

        return mapLayers;
    };

    getMapComponent = () => null;
}
