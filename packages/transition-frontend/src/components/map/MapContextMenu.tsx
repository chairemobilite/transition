/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenuManager } from '../../services/map/ContextMenuManager';

export const MapContextMenu: React.FC = () => (
    <div id="tr__main-map-context-menu" className="tr__main-map-context-menu"></div>
);

export const useContextMenu = () => {
    const contextMenuManagerRef = useRef<ContextMenuManager | null>(null);
    const { t } = useTranslation(['transit', 'main']);

    useEffect(() => {
        contextMenuManagerRef.current = new ContextMenuManager('tr__main-map-context-menu');

        return () => {
            contextMenuManagerRef.current?.destroy();
        };
    }, []);

    const showContextMenu = React.useCallback(
        (
            position: [number, number],
            elements: { key?: string; title: string; onClick: () => void; onHover?: () => void }[]
        ) => {
            contextMenuManagerRef.current?.show(position, elements);
        },
        []
    );

    const hideContextMenu = React.useCallback(() => {
        contextMenuManagerRef.current?.hide();
    }, []);

    return {
        showContextMenu,
        hideContextMenu
    };
};
