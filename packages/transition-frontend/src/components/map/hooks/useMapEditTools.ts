/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { useState, useCallback } from 'react';
import { MapCallbacks } from 'chaire-lib-frontend/lib/services/map/IMapEventHandler';
import { MapEditTool } from '../types/TransitionMainMapTypes';
import { Layer, LayerProps } from '@deck.gl/core';
import { TransitionMapLayerProps } from '../layers/TransitionMapLayer';

export const useMapEditTools = (mapEventsManager: any, mapCallbacks: MapCallbacks) => {
    const [mapEditTool, setMapEditTool] = useState<MapEditTool | undefined>(undefined);
    const [editUpdateCount, setEditUpdateCount] = useState(0);
    const [activeMapEventManager, setActiveMapEventManager] = useState(mapEventsManager);

    const enableEditTool = useCallback(
        (ToolConstructor: any) => {
            const newMapEditTool = new ToolConstructor({
                onUpdate: () => {
                    setEditUpdateCount((prev) => prev + 1);
                },
                onDisable: () => {
                    setMapEditTool(undefined);
                    setActiveMapEventManager(mapEventsManager);
                }
            });

            setMapEditTool(newMapEditTool);
            setActiveMapEventManager(new mapEventsManager.constructor(newMapEditTool.getMapEvents(), mapCallbacks));
        },
        [mapCallbacks, mapEventsManager]
    );

    const disableEditTool = useCallback(() => {
        setMapEditTool(undefined);
        setActiveMapEventManager(mapEventsManager);
    }, [mapEventsManager]);

    const getEditToolLayers = useCallback(
        (props: Omit<TransitionMapLayerProps, 'layerDescription' | 'events'>): Layer<LayerProps>[] => {
            if (mapEditTool === undefined) return [];

            const editToolLayers = mapEditTool.getLayers({
                ...props,
                updateCount: editUpdateCount
            });

            return editToolLayers || [];
        },
        [mapEditTool, editUpdateCount]
    );

    return {
        mapEditTool,
        activeMapEventManager,
        editUpdateCount,
        enableEditTool,
        disableEditTool,
        getEditToolLayers
    };
};
