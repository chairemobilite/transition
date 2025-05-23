/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _cloneDeep from 'lodash/cloneDeep';
import { Layer, LayerProps } from '@deck.gl/core';
import { MjolnirEvent } from 'mjolnir.js';
import { point as turfPoint, featureCollection as turfFeatureCollection } from '@turf/turf';

import { MapEventHandlerDescriptor, PointInfo } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MeasureTool } from 'transition-common/lib/services/measureTool/MeasureTool';

import getLayer, { TransitionMapLayerProps } from '../layers/TransitionMapLayer';
import { MapEditFeature } from '../MapEditFeature';
import MeasureDistanceDisplay from '../../parts/MeasureDistanceDisplay';

const layers = {
    measureToolLine: {
        type: 'line' as const,
        color: [255, 255, 255, 150] as [number, number, number, number],
        strokeWidth: 1,
        widthUnits: 'pixels' as const,
        widthScale: 1,
        widthMinPixels: 3,
        capRounded: true,
        jointRounded: true
    },

    measureToolText: {
        type: 'text' as const,
        //fontFamily: 'Arial',
        //fontWeight: 'bold',
        fontSize: '1.5rem',
        background: true,
        backgroundPadding: 2
    },

    measureToolPoint: {
        type: 'circle' as const,
        radiusUnits: 'pixels' as const,
        strokeColor: [255, 255, 255, 150] as [number, number, number, number],
        strokeWidth: 2,
        fillColor: [0, 0, 0, 255] as [number, number, number, number],
        radius: 4,
        radiusScale: 1,
        lineWidthScale: 1,
        lineWidthUnits: 'pixels' as const
    }
};

export class MeasureToolMapFeature implements MapEditFeature {
    static editMode = 'measureTool';

    private _measureTool: MeasureTool = new MeasureTool(undefined, undefined, undefined);
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
            }
        ];
    }

    private onMapClicked = (pointInfo: PointInfo, _event: MjolnirEvent) => {
        const measureTool = this._measureTool;
        measureTool.addVertex(turfPoint(pointInfo.coordinates as [number, number]));
        this._callbacks.onUpdate();
        return true;
    };

    private onMapRightClicked = (_pointInfo: PointInfo, _event: MjolnirEvent) => {
        // Disable the tool
        this._callbacks.onDisable();
        return true;
    };

    getEditMode = () => MeasureToolMapFeature.editMode;
    getMapEvents = () => this._events;
    getLayers = (props: Omit<TransitionMapLayerProps, 'layerDescription' | 'events'>) => {
        const mapLayers: Layer<LayerProps>[] = [];
        const lineFeature = this._measureTool.getLineGeojson();
        if (lineFeature) {
            const lineLayers = getLayer({
                ...props,
                layerDescription: {
                    id: 'measureToolLine',
                    visible: true,
                    configuration: layers.measureToolLine,
                    layerData: turfFeatureCollection([lineFeature])
                }
            });
            if (lineLayers) {
                mapLayers.push(...lineLayers);
            }
        }

        const textFeatureCollection = _cloneDeep(this._measureTool.getLabelsGeojsonCollection()); // must clone deep otherwise the object fills the buffer
        if (textFeatureCollection.features.length > 0) {
            const textLayers = getLayer({
                ...props,
                layerDescription: {
                    id: 'measureToolText',
                    visible: true,
                    configuration: layers.measureToolText,
                    layerData: textFeatureCollection
                }
            });
            if (textLayers) {
                mapLayers.push(...textLayers);
            }
        }

        const pointFeatureCollection = _cloneDeep(this._measureTool.getPointsGeojsonCollection());
        if (pointFeatureCollection.features.length > 0) {
            const pointLayers = getLayer({
                ...props,
                layerDescription: {
                    id: 'measureToolPoint',
                    visible: true,
                    configuration: layers.measureToolPoint,
                    layerData: pointFeatureCollection
                }
            });
            if (pointLayers) {
                mapLayers.push(...pointLayers);
            }
        }

        return mapLayers;
    };

    getMapComponent = () => <MeasureDistanceDisplay measureTool={this._measureTool} />;
}
