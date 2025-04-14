/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { useEffect, useCallback } from 'react';
import { PickingInfo } from '@deck.gl/core';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { MapEventsManager } from '../../../services/map/MapEventsManager';

export const useMapEvents = (
    mapEventsManager: MapEventsManager,
    activeSection: string,
    updateSelectedObjectsCount: () => void,
    updateSelectedObjectDraggingCount: () => void,
    fitBounds: (bounds: [[number, number], [number, number]]) => void,
    showContextMenu: (
        position: [number, number],
        elements: { key?: string; title: string; onClick: () => void; onHover?: () => void }[]
    ) => void,
    hideContextMenu: () => void
) => {
    // Tooltip handler
    const onTooltip = useCallback(
        (pickInfo: PickingInfo) => {
            if (pickInfo.picked === true && pickInfo.layer) {
                if (!pickInfo.object) {
                    return null;
                }
                const tooltipEvents = mapEventsManager.getTooltipEvents(pickInfo.layer.id).onTooltip;
                if (tooltipEvents) {
                    for (let i = 0; i < tooltipEvents.length; i++) {
                        const tooltip = mapEventsManager.executeTooltipEvent(tooltipEvents[i], pickInfo, activeSection);
                        if (tooltip !== undefined) {
                            return typeof tooltip === 'string'
                                ? tooltip
                                : tooltip.containsHtml === true
                                    ? { html: tooltip.text }
                                    : tooltip.text;
                        }
                    }
                }
            }
            return null;
        },
        [activeSection, mapEventsManager]
    );

    // Register event listeners
    useEffect(() => {
        // Set up non-layer-related event listeners
        serviceLocator.eventManager.on('map.fitBounds', fitBounds);
        serviceLocator.eventManager.on('map.showContextMenu', showContextMenu);
        serviceLocator.eventManager.on('map.hideContextMenu', hideContextMenu);

        for (const objectType of ['node', 'path', 'service', 'scenario']) {
            serviceLocator.eventManager.on(`selected.deselect.${objectType}`, updateSelectedObjectsCount);
            serviceLocator.eventManager.on(`selected.update.${objectType}`, updateSelectedObjectsCount);
        }
        for (const objectType of ['node']) {
            serviceLocator.eventManager.on(`selected.drag.${objectType}`, updateSelectedObjectDraggingCount);
        }

        return () => {
            serviceLocator.eventManager.off('map.fitBounds', fitBounds);
            serviceLocator.eventManager.off('map.showContextMenu', showContextMenu);
            serviceLocator.eventManager.off('map.hideContextMenu', hideContextMenu);

            for (const objectType of ['node', 'path', 'service', 'scenario']) {
                serviceLocator.eventManager.off(`selected.deselect.${objectType}`, updateSelectedObjectsCount);
                serviceLocator.eventManager.off(`selected.update.${objectType}`, updateSelectedObjectsCount);
            }
            for (const objectType of ['node']) {
                serviceLocator.eventManager.off(`selected.drag.${objectType}`, updateSelectedObjectDraggingCount);
            }
        };
    }, [fitBounds, showContextMenu, hideContextMenu, updateSelectedObjectsCount, updateSelectedObjectDraggingCount]);

    return {
        onTooltip
    };
};
