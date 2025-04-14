/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { WebMercatorViewport } from '@deck.gl/core';

import { MapButton } from '../parts/MapButton';
import { MapEditTool } from './types/TransitionMainMapTypes';
import { MeasureToolMapFeature } from './tools/MapMeasureTool';
import { PolygonDrawMapFeature } from './tools/MapPolygonDrawTool';
import { getDefaultViewState } from './defaults/TransitionMainMapDefaults';

interface MapToolbarProps {
    activeSection: string;
    mapEditTool?: MapEditTool;
    enableEditTool: (toolConstructor: any) => void;
    disableEditTool: () => void;
    viewState: any;
}

export const MapToolbar: React.FC<MapToolbarProps> = ({
    activeSection,
    mapEditTool,
    enableEditTool,
    disableEditTool,
    viewState
}) => {
    return (
        <div className="tr__map-button-container">
            <MapButton
                title="main:map:controls:resetView"
                key="mapbtn_resetView"
                className={''}
                onClick={(e) => {
                    e.stopPropagation();
                    const { zoom, latitude, longitude } = getDefaultViewState();
                    const viewport = new WebMercatorViewport({
                        ...viewState,
                        zoom,
                        latitude,
                        longitude
                    });
                }}
                iconPath={'/dist/images/icons/interface/preferences_white.svg'}
            />
            <MapButton
                title="main:MeasureTool"
                key="mapbtn_measuretool"
                className={`${mapEditTool?.getEditMode() === MeasureToolMapFeature.editMode ? 'active' : ''}`}
                onClick={() => {
                    if (mapEditTool?.getEditMode() === MeasureToolMapFeature.editMode) {
                        disableEditTool();
                    } else {
                        enableEditTool(MeasureToolMapFeature);
                    }
                }}
                iconPath={'/dist/images/icons/interface/ruler_white.svg'}
            />
            {activeSection === 'nodes' && (
                <MapButton
                    title="main:PolygonDrawTool"
                    key="mapbtn_polygontool"
                    className={`${mapEditTool?.getEditMode() === PolygonDrawMapFeature.editMode ? 'active' : ''}`}
                    onClick={() => {
                        if (mapEditTool?.getEditMode() === PolygonDrawMapFeature.editMode) {
                            disableEditTool();
                        } else {
                            enableEditTool(PolygonDrawMapFeature);
                        }
                    }}
                    iconPath={'/dist/images/icons/interface/select_white.svg'}
                />
            )}
        </div>
    );
};
