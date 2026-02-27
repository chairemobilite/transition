/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { use, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Menu, { MenuItem } from 'rc-menu';

import 'rc-menu/assets/index.css';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import { loadLayersAndCollections } from '../../services/dashboard/LayersAndCollectionsService';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import { ThemeContext } from 'chaire-lib-frontend/lib/contexts/ThemeContext';

const Toolbar: React.FunctionComponent<LayoutSectionProps> = (_props) => {
    const { t } = useTranslation(['transit', 'main', 'od', 'notifications']);
    // Get the current theme (light or dark)
    const theme = use(ThemeContext);
    const iconVariant = theme === 'dark' ? 'white' : 'black';

    const [coordinates, setCoordinates] = useState<[number, number] | undefined>(undefined);
    const [layersVisibility, setLayersVisibility] = useState<{ [key: string]: boolean }>({});
    const [cacheNeedsSaving, setCacheNeedsSaving] = useState(false);
    const [trRoutingStarted, setTrRoutingStarted] = useState(false);
    const [nodesNeedUpdate, setNodesNeedUpdate] = useState(false);
    const [dataNeedsUpdate, setDataNeedsUpdate] = useState(false);

    const checkTrRoutingStatus = useCallback(() => {
        serviceLocator.socketEventManager.emit('service.trRouting.status', {}, (response: { status: string }) => {
            setTrRoutingStarted(response.status === 'started');
        });
    }, []);

    useEffect(() => {
        // TODO Replace with proper API calls for better typing support
        const onUpdateCoordinates = (coords: [number, number]) => setCoordinates(coords);
        const onShowLayer = (layerName: string) => {
            setLayersVisibility((prev) => {
                if (prev[layerName] === false) {
                    const next = { ...prev };
                    next[layerName] = true;
                    return next;
                }
                return prev;
            });
        };
        const onHideLayer = (layerName: string) => {
            setLayersVisibility((prev) => {
                if (prev[layerName] === true) {
                    const next = { ...prev };
                    next[layerName] = false;
                    return next;
                }
                return prev;
            });
        };
        const onUpdateLayers = () => {
            const visibility: { [key: string]: boolean } = {};
            serviceLocator.layerManager._enabledLayers.forEach((layerName) => {
                visibility[layerName] = serviceLocator.layerManager.layerIsVisible(layerName);
            });
            setLayersVisibility(visibility);
        };
        const onCacheDirty = () => setCacheNeedsSaving(true);
        const onCacheClean = () => setCacheNeedsSaving(false);
        const onDataUpdated = () => setDataNeedsUpdate(true);
        const onTrRoutingStarted = () => setTrRoutingStarted(true);
        const onTrRoutingStopped = () => setTrRoutingStarted(false);
        const onNodesNeedUpdate = () => setNodesNeedUpdate(true);
        const onNodesUpdated = () => setNodesNeedUpdate(false);

        serviceLocator.eventManager.on('map.updateMouseCoordinates', onUpdateCoordinates);
        serviceLocator.eventManager.on('map.showLayer', onShowLayer);
        serviceLocator.eventManager.on('map.hideLayer', onHideLayer);
        serviceLocator.eventManager.on('map.updatedEnabledLayers', onUpdateLayers);
        serviceLocator.socketEventManager.on('cache.dirty', onCacheDirty);
        serviceLocator.socketEventManager.on('cache.clean', onCacheClean);
        serviceLocator.socketEventManager.on('data.updated', onDataUpdated);
        serviceLocator.socketEventManager.on('service.trRouting.started', onTrRoutingStarted);
        serviceLocator.socketEventManager.on('service.trRouting.stopped', onTrRoutingStopped);
        serviceLocator.socketEventManager.on('connect', checkTrRoutingStatus);
        serviceLocator.socketEventManager.on('transferableNodes.dirty', onNodesNeedUpdate);
        serviceLocator.eventManager.on('transferableNodes.dirty', onNodesNeedUpdate);
        serviceLocator.eventManager.on('transferableNodes.clean', onNodesUpdated);

        checkTrRoutingStatus();

        return () => {
            serviceLocator.eventManager.off('map.updateMouseCoordinates', onUpdateCoordinates);
            serviceLocator.eventManager.off('map.showLayer', onShowLayer);
            serviceLocator.eventManager.off('map.hideLayer', onHideLayer);
            serviceLocator.eventManager.off('map.updatedEnabledLayers', onUpdateLayers);
            serviceLocator.socketEventManager.off('cache.dirty', onCacheDirty);
            serviceLocator.socketEventManager.off('cache.clean', onCacheClean);
            serviceLocator.socketEventManager.off('data.updated', onDataUpdated);
            serviceLocator.socketEventManager.off('service.trRouting.started', onTrRoutingStarted);
            serviceLocator.socketEventManager.off('service.trRouting.stopped', onTrRoutingStopped);
            serviceLocator.socketEventManager.off('connect', checkTrRoutingStatus);
            serviceLocator.socketEventManager.off('transferableNodes.dirty', onNodesNeedUpdate);
            serviceLocator.eventManager.off('transferableNodes.dirty', onNodesNeedUpdate);
            serviceLocator.eventManager.off('transferableNodes.clean', onNodesUpdated);
        };
    }, [checkTrRoutingStatus]);

    const _restartTrRouting = useCallback(
        (parameters: Record<string, unknown> = {}) => {
            serviceLocator.eventManager.emit('progress', { name: 'RestartTrRouting', progress: 0.0 });
            serviceLocator.socketEventManager.emit(
                'service.trRouting.restart',
                parameters,
                (response: { status: string }) => {
                    if (response.status !== 'started' && response.status !== 'no_restart_required') {
                        serviceLocator.eventManager.emit('error', {
                            name: 'RestartTrRoutingError',
                            error: response.status
                        });
                    }
                    serviceLocator.eventManager.emit('progress', { name: 'RestartTrRouting', progress: 1.0 });
                    checkTrRoutingStatus();
                }
            );
        },
        [checkTrRoutingStatus]
    );

    const fetchData = useCallback(async () => {
        try {
            await loadLayersAndCollections({
                serviceLocator,
                agencyCollection: serviceLocator.collectionManager.get('agencies'),
                scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
                serviceCollection: serviceLocator.collectionManager.get('services'),
                lineCollection: serviceLocator.collectionManager.get('lines'),
                pathCollection: serviceLocator.collectionManager.get('paths'),
                nodeCollection: serviceLocator.collectionManager.get('nodes'),
                placeCollection: serviceLocator.collectionManager.get('places'),
                simulationCollection: serviceLocator.collectionManager.get('simulations'),
                dataSourceCollection: serviceLocator.collectionManager.get('dataSources')
            });
        } catch (error) {
            console.error('Error loading layers and collections:', error);
        } finally {
            setDataNeedsUpdate(false);
        }
    }, []);

    const saveAllCache = useCallback(() => {
        serviceLocator.eventManager.emit('progress', { name: 'SavingAllCache', progress: 0.0 });
        serviceLocator.socketEventManager.emit('cache.saveAll', () => {
            serviceLocator.eventManager.emit('progress', { name: 'SavingAllCache', progress: 1.0 });
            _restartTrRouting({ doNotStartIfStopped: true });
        });
    }, [_restartTrRouting]);

    const saveAndUpdateNodes = useCallback(() => {
        serviceLocator.socketEventManager.emit(
            'transitNodes.updateTransferableNodes',
            (status: Status.Status<number>) => {
                if (Status.isStatusOk(status)) {
                    setNodesNeedUpdate(false);
                } else {
                    console.error(`Error updating transferrable nodes: ${status.error}`);
                    serviceLocator.eventManager.emit('progress', {
                        name: 'UpdatingTransferableNodes',
                        progress: 1.0
                    });
                }
            }
        );
    }, []);

    const restartTrRouting = useCallback(() => {
        _restartTrRouting({});
    }, [_restartTrRouting]);

    return (
        <React.Fragment>
            {coordinates && coordinates.length === 2 && (
                <div className="tr__top-menu-buttons-container _small _pale">
                    <span style={{ width: '8rem' }}>{roundToDecimals(coordinates[0], 5)!.toFixed(5)},</span>
                    <span style={{ width: '7rem' }}>{roundToDecimals(coordinates[1], 5)!.toFixed(5)}</span>
                </div>
            )}

            <Menu className="tr__top-menu-buttons-container">
                {dataNeedsUpdate && (
                    <MenuItem
                        key="tr__top-menu-button-fetch-data"
                        title={t('transit:FetchNewData')}
                        className="tr__top-menu-button"
                        onClick={fetchData}
                    >
                        <img
                            className="_icon"
                            src={'/dist/images/icons/interface/download_cloud_yellow.svg'}
                            alt={t('transit:FetchNewData')}
                            title={t('transit:FetchNewData')}
                        />
                    </MenuItem>
                )}
                {layersVisibility.transitPaths === true && (
                    <MenuItem
                        key="tr__top-menu-button-hide-paths"
                        title={t('transit:transitPath:HidePaths')}
                        className="tr__top-menu-button"
                        onClick={() => serviceLocator.eventManager.emit('map.hideLayer', 'transitPaths')}
                    >
                        <img
                            className="_icon"
                            src={`/dist/images/icons/transit/paths_visible_${iconVariant}.svg`}
                            alt={t('transit:transitPath:HidePaths')}
                            title={t('transit:transitPath:HidePaths')}
                        />
                    </MenuItem>
                )}
                {layersVisibility.transitPaths === false && (
                    <MenuItem
                        key="tr__top-menu-button-show-paths"
                        title={t('transit:transitPath:ShowPaths')}
                        className="tr__top-menu-button"
                        onClick={() => serviceLocator.eventManager.emit('map.showLayer', 'transitPaths')}
                    >
                        <img
                            className="_icon"
                            src={`/dist/images/icons/transit/paths_hidden_${iconVariant}.svg`}
                            alt={t('transit:transitPath:ShowPaths')}
                            title={t('transit:transitPath:ShowPaths')}
                        />
                    </MenuItem>
                )}
                {layersVisibility.transitNodes === true && (
                    <MenuItem
                        key="tr__top-menu-button-hide-nodes"
                        title={t('transit:transitNode:HideNodes')}
                        className="tr__top-menu-button"
                        onClick={() => serviceLocator.eventManager.emit('map.hideLayer', 'transitNodes')}
                    >
                        <img
                            className="_icon"
                            src={`/dist/images/icons/transit/nodes_visible_${iconVariant}.svg`}
                            alt={t('transit:transitNode:HideNodes')}
                            title={t('transit:transitNode:HideNodes')}
                        />
                    </MenuItem>
                )}
                {layersVisibility.transitNodes === false && (
                    <MenuItem
                        key="tr__top-menu-button-show-nodes"
                        title={t('transit:transitNode:ShowNodes')}
                        className="tr__top-menu-button"
                        onClick={() => serviceLocator.eventManager.emit('map.showLayer', 'transitNodes')}
                    >
                        <img
                            className="_icon"
                            src={`/dist/images/icons/transit/nodes_hidden_${iconVariant}.svg`}
                            alt={t('transit:transitNode:ShowNodes')}
                            title={t('transit:transitNode:ShowNodes')}
                        />
                    </MenuItem>
                )}

                <MenuItem
                    key="tr__top-menu-button-save-and-update-nodes"
                    title={t('transit:transitNode:SaveAllAndUpdateTransferableNodes')}
                    className="tr__top-menu-button"
                    onClick={saveAndUpdateNodes}
                >
                    <img
                        className="_icon"
                        src={
                            nodesNeedUpdate
                                ? '/dist/images/icons/transit/transfer_refresh_yellow.svg'
                                : `/dist/images/icons/transit/transfer_refresh_${iconVariant}.svg`
                        }
                        alt={t('transit:transitNode:SaveAllAndUpdateTransferableNodes')}
                        title={t('transit:transitNode:SaveAllAndUpdateTransferableNodes')}
                    />
                </MenuItem>
                <MenuItem
                    key="tr__top-menu-button-save-all-cache"
                    title={t('main:SaveAllData')}
                    className="tr__top-menu-button"
                    onClick={saveAllCache}
                >
                    <img
                        className="_icon"
                        src={
                            cacheNeedsSaving
                                ? '/dist/images/icons/interface/download_cloud_yellow.svg'
                                : `/dist/images/icons/interface/download_cloud_${iconVariant}.svg`
                        }
                        alt={t('main:SaveAllData')}
                        title={t('main:SaveAllData')}
                    />
                </MenuItem>
                <MenuItem
                    key="tr__top-menu-button-restart-tr-routing"
                    title={t('main:RestartTrRouting')}
                    className="tr__top-menu-button"
                    onClick={restartTrRouting}
                >
                    <img
                        className="_icon"
                        src={
                            !trRoutingStarted
                                ? '/dist/images/icons/interface/restart_routing_yellow.svg'
                                : `/dist/images/icons/interface/restart_routing_${iconVariant}.svg`
                        }
                        alt={t('main:RestartTrRouting')}
                        title={t('main:RestartTrRouting')}
                    />
                </MenuItem>
            </Menu>
        </React.Fragment>
    );
};

export default Toolbar;
