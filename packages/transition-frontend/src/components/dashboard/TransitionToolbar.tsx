/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import Menu, { MenuItem } from 'rc-menu';

import 'rc-menu/assets/index.css';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { loadLayersAndCollections } from '../../services/dashboard/LayersAndCollectionsService';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';

interface TransitionToolbarState {
    coordinates?: [number, number];
    layersVisibility: { [key: string]: boolean };
    cacheNeedsSaving: boolean;
    trRoutingStarted: boolean;
    nodesNeedUpdate: boolean;
    dataNeedsUpdate: boolean;
}

class Toolbar extends React.Component<LayoutSectionProps & WithTranslation, TransitionToolbarState> {
    constructor(props: LayoutSectionProps & WithTranslation) {
        super(props);

        this.state = {
            layersVisibility: {},
            cacheNeedsSaving: false,
            trRoutingStarted: false,
            nodesNeedUpdate: false,
            dataNeedsUpdate: false
        };
    }

    componentDidMount() {
        // TODO Replace with proper API calls for better typing support
        serviceLocator.eventManager.on('map.updateMouseCoordinates', this.onUpdateCoordinates);
        serviceLocator.eventManager.on('map.showLayer', this.onShowLayer);
        serviceLocator.eventManager.on('map.hideLayer', this.onHideLayer);
        serviceLocator.eventManager.on('map.updatedEnabledLayers', this.onUpdateLayers);
        serviceLocator.socketEventManager.on('cache.dirty', this.onCacheDirty);
        serviceLocator.socketEventManager.on('cache.clean', this.onCacheClean);
        serviceLocator.socketEventManager.on('data.updated', this.onDataUpdated);
        serviceLocator.socketEventManager.on('service.trRouting.started', this.onTrRoutingStarted);
        serviceLocator.socketEventManager.on('service.trRouting.stopped', this.onTrRoutingStopped);
        serviceLocator.socketEventManager.on('connect', this.checkTrRoutingStatus);
        serviceLocator.socketEventManager.on('transferableNodes.dirty', this.onNodesNeedUpdate);
        serviceLocator.eventManager.on('transferableNodes.dirty', this.onNodesNeedUpdate);
        serviceLocator.eventManager.on('transferableNodes.clean', this.onNodesUpdated);
        this.checkTrRoutingStatus();
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('map.updateMouseCoordinates', this.onUpdateCoordinates);
        serviceLocator.eventManager.off('map.showLayer', this.onShowLayer);
        serviceLocator.eventManager.off('map.hideLayer', this.onHideLayer);
        serviceLocator.eventManager.off('map.updatedEnabledLayers', this.onUpdateLayers);
        serviceLocator.socketEventManager.off('cache.dirty', this.onCacheDirty);
        serviceLocator.socketEventManager.off('cache.clean', this.onCacheClean);
        serviceLocator.socketEventManager.off('data.updated', this.onDataUpdated);
        serviceLocator.socketEventManager.off('service.trRouting.started', this.onTrRoutingStarted);
        serviceLocator.socketEventManager.off('service.trRouting.stopped', this.onTrRoutingStopped);
        serviceLocator.socketEventManager.off('connect', this.checkTrRoutingStatus);
        serviceLocator.socketEventManager.off('transferableNodes.dirty', this.onNodesNeedUpdate);
        serviceLocator.eventManager.off('transferableNodes.dirty', this.onNodesNeedUpdate);
        serviceLocator.eventManager.off('transferableNodes.clean', this.onNodesUpdated);
    }

    onUpdateLayers = () => {
        /*   const layersVisibility = {};
        serviceLocator.layerManager._enabledLayers.forEach((layerName) => {
            layersVisibility[layerName] = serviceLocator.layerManager.layerIsVisible(layerName);
        });
        this.setState((_oldState) => {
            return {
                layersVisibility
            };
        }); */
    };

    onShowLayer = (layerName: string) => {
        /*    if (this.state.layersVisibility[layerName] === false) {
            this.setState((oldState) => {
                oldState.layersVisibility[layerName] = true;
                return {
                    layersVisibility: oldState.layersVisibility
                };
            });
        } */
    };

    onHideLayer = (layerName: string) => {
        /*    if (this.state.layersVisibility[layerName] === true) {
            this.setState((oldState) => {
                oldState.layersVisibility[layerName] = false;
                return {
                    layersVisibility: oldState.layersVisibility
                };
            });
        } */
    };

    onUpdateCoordinates = (coordinates: [number, number]) => {
        this.setState({
            coordinates
        });
    };

    onCacheDirty = () => {
        this.setState({
            cacheNeedsSaving: true
        });
    };

    onCacheClean = () => {
        this.setState({
            cacheNeedsSaving: false
        });
    };

    onDataUpdated = () => {
        this.setState({ dataNeedsUpdate: true });
    };

    fetchData = () => {
        loadLayersAndCollections({
            serviceLocator,
            //aggregatedODGeojsonCollection: serviceLocator.collectionManager.get('aggregatedOD'),
            agencyCollection: serviceLocator.collectionManager.get('agencies'),
            scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
            serviceCollection: serviceLocator.collectionManager.get('services'),
            //garageCollection: serviceLocator.collectionManager.get('garages'),
            //unitCollection: serviceLocator.collectionManager.get('units'),
            lineCollection: serviceLocator.collectionManager.get('lines'),
            pathCollection: serviceLocator.collectionManager.get('paths'),
            nodeCollection: serviceLocator.collectionManager.get('nodes'),
            placeCollection: serviceLocator.collectionManager.get('places'),
            simulationCollection: serviceLocator.collectionManager.get('simulations'),
            dataSourceCollection: serviceLocator.collectionManager.get('dataSources')
        });
        this.setState({ dataNeedsUpdate: false });
    };

    onTrRoutingStarted = () => {
        this.setState({
            trRoutingStarted: true
        });
    };

    onTrRoutingStopped = () => {
        this.setState({
            trRoutingStarted: false
        });
    };

    onNodesNeedUpdate = () => {
        this.setState({
            nodesNeedUpdate: true
        });
    };

    onNodesUpdated = () => {
        this.setState({
            nodesNeedUpdate: false
        });
    };

    checkTrRoutingStatus = () => {
        serviceLocator.socketEventManager.emit('service.trRouting.status', {}, (response: { status: any }) => {
            this.setState({
                trRoutingStarted: response.status === 'started'
            });
        });
    };

    saveAllCache = () => {
        serviceLocator.eventManager.emit('progress', { name: 'SavingAllCache', progress: 0.0 });
        serviceLocator.socketEventManager.emit('cache.saveAll', () => {
            serviceLocator.eventManager.emit('progress', { name: 'SavingAllCache', progress: 1.0 });
            this._restartTrRouting({ doNotStartIfStopped: true });
        });
    };

    saveAndUpdateNodes = () => {
        serviceLocator.socketEventManager.emit(
            'transitNodes.updateTransferableNodes',
            (status: Status.Status<number>) => {
                if (Status.isStatusOk(status)) {
                    this.setState({ nodesNeedUpdate: false });
                } else {
                    console.error(`Error updating transferrable nodes: ${status.error}`);
                    serviceLocator.eventManager.emit('progress', { name: 'UpdatingTransferableNodes', progress: 1.0 });
                }
            }
        );
    };

    _restartTrRouting = (parameters = {}) => {
        serviceLocator.eventManager.emit('progress', { name: 'RestartTrRouting', progress: 0.0 });
        serviceLocator.socketEventManager.emit('service.trRouting.restart', parameters, (response) => {
            if (response.status !== 'started' && response.status !== 'no_restart_required') {
                serviceLocator.eventManager.emit('error', { name: 'RestartTrRoutingError', error: response.status });
            }
            serviceLocator.eventManager.emit('progress', { name: 'RestartTrRouting', progress: 1.0 });
            this.checkTrRoutingStatus();
        });
    };

    restartTrRouting = () => {
        this._restartTrRouting({});
    };

    render() {
        return (
            <React.Fragment>
                {this.state.coordinates && this.state.coordinates.length === 2 && (
                    <div className="tr__top-menu-buttons-container _small _pale">
                        <span style={{ width: '8rem' }}>
                            {roundToDecimals(this.state.coordinates[0], 5)!.toFixed(5)},
                        </span>
                        <span style={{ width: '7rem' }}>
                            {roundToDecimals(this.state.coordinates[1], 5)!.toFixed(5)}
                        </span>
                    </div>
                )}

                <Menu className="tr__top-menu-buttons-container">
                    {this.state.dataNeedsUpdate && (
                        <MenuItem
                            title={this.props.t('transit:FetchNewData')}
                            className="tr__top-menu-button"
                            onClick={this.fetchData}
                        >
                            <img
                                className="_icon"
                                src={'/dist/images/icons/interface/download_cloud_yellow.svg'}
                                alt={this.props.t('transit:FetchNewData')}
                                title={this.props.t('transit:FetchNewData')}
                            />
                        </MenuItem>
                    )}
                    {this.state.layersVisibility.transitPaths === true && (
                        <MenuItem
                            title={this.props.t('transit:transitPath:HidePaths')}
                            className="tr__top-menu-button"
                            onClick={function () {
                                serviceLocator.eventManager.emit('map.hideLayer', 'transitPaths');
                            }}
                        >
                            <img
                                className="_icon"
                                src={'/dist/images/icons/transit/paths_visible_white.svg'}
                                alt={this.props.t('transit:transitPath:HidePaths')}
                                title={this.props.t('transit:transitPath:HidePaths')}
                            />
                        </MenuItem>
                    )}
                    {this.state.layersVisibility.transitPaths === false && (
                        <MenuItem
                            title={this.props.t('transit:transitPath:ShowPaths')}
                            className="tr__top-menu-button"
                            onClick={function () {
                                serviceLocator.eventManager.emit('map.showLayer', 'transitPaths');
                            }}
                        >
                            <img
                                className="_icon"
                                src={'/dist/images/icons/transit/paths_hidden_white.svg'}
                                alt={this.props.t('transit:transitPath:ShowPaths')}
                                title={this.props.t('transit:transitPath:ShowPaths')}
                            />
                        </MenuItem>
                    )}
                    {this.state.layersVisibility.transitNodes === true && (
                        <MenuItem
                            title={this.props.t('transit:transitNode:HideNodes')}
                            className="tr__top-menu-button"
                            onClick={function () {
                                serviceLocator.eventManager.emit('map.hideLayer', 'transitNodes');
                            }}
                        >
                            <img
                                className="_icon"
                                src={'/dist/images/icons/transit/nodes_visible_white.svg'}
                                alt={this.props.t('transit:transitNode:HideNodes')}
                                title={this.props.t('transit:transitNode:HideNodes')}
                            />
                        </MenuItem>
                    )}
                    {this.state.layersVisibility.transitNodes === false && (
                        <MenuItem
                            title={this.props.t('transit:transitNode:ShowNodes')}
                            className="tr__top-menu-button"
                            onClick={function () {
                                serviceLocator.eventManager.emit('map.showLayer', 'transitNodes');
                            }}
                        >
                            <img
                                className="_icon"
                                src={'/dist/images/icons/transit/nodes_hidden_white.svg'}
                                alt={this.props.t('transit:transitNode:ShowNodes')}
                                title={this.props.t('transit:transitNode:ShowNodes')}
                            />
                        </MenuItem>
                    )}

                    {Preferences.get('showAggregatedOdTripsLayer') &&
                        this.state.layersVisibility.aggregatedOD === true && (
                        <MenuItem
                            title={this.props.t('od:HideAggregatedOD')}
                            className="tr__top-menu-button"
                            onClick={function () {
                                serviceLocator.eventManager.emit('map.hideLayer', 'aggregatedOD');
                            }}
                        >
                            <img
                                className="_icon"
                                src={'/dist/images/icons/od/aggregated_od_visible_white.svg'}
                                alt={this.props.t('od:HideAggregatedOD')}
                                title={this.props.t('od:HideAggregatedOD')}
                            />
                        </MenuItem>
                    )}
                    {Preferences.get('showAggregatedOdTripsLayer') &&
                        this.state.layersVisibility.aggregatedOD === false && (
                        <MenuItem
                            title={this.props.t('od:ShowAggregatedOD')}
                            className="tr__top-menu-button"
                            onClick={function () {
                                serviceLocator.eventManager.emit('map.showLayer', 'aggregatedOD');
                            }}
                        >
                            <img
                                className="_icon"
                                src={'/dist/images/icons/od/aggregated_od_hidden_white.svg'}
                                alt={this.props.t('od:ShowAggregatedOD')}
                                title={this.props.t('od:ShowAggregatedOD')}
                            />
                        </MenuItem>
                    )}

                    <MenuItem
                        title={this.props.t('transit:transitNode:SaveAllAndUpdateTransferableNodes')}
                        className="tr__top-menu-button"
                        onClick={this.saveAndUpdateNodes}
                    >
                        <img
                            className="_icon"
                            src={
                                this.state.nodesNeedUpdate
                                    ? '/dist/images/icons/transit/transfer_refresh_yellow.svg'
                                    : '/dist/images/icons/transit/transfer_refresh_white.svg'
                            }
                            alt={this.props.t('transit:transitNode:SaveAllAndUpdateTransferableNodes')}
                            title={this.props.t('transit:transitNode:SaveAllAndUpdateTransferableNodes')}
                        />
                    </MenuItem>
                    <MenuItem
                        title={this.props.t('main:SaveAllData')}
                        className="tr__top-menu-button"
                        onClick={this.saveAllCache}
                    >
                        <img
                            className="_icon"
                            src={
                                this.state.cacheNeedsSaving
                                    ? '/dist/images/icons/interface/download_cloud_yellow.svg'
                                    : '/dist/images/icons/interface/download_cloud_white.svg'
                            }
                            alt={this.props.t('main:SaveAllData')}
                            title={this.props.t('main:SaveAllData')}
                        />
                    </MenuItem>
                    <MenuItem
                        title={this.props.t('main:RestartTrRouting')}
                        className="tr__top-menu-button"
                        onClick={this.restartTrRouting}
                    >
                        <img
                            className="_icon"
                            src={
                                !this.state.trRoutingStarted
                                    ? '/dist/images/icons/interface/restart_routing_yellow.svg'
                                    : '/dist/images/icons/interface/restart_routing_white.svg'
                            }
                            alt={this.props.t('main:RestartTrRouting')}
                            title={this.props.t('main:RestartTrRouting')}
                        />
                    </MenuItem>
                </Menu>
            </React.Fragment>
        );
    }
}

export default withTranslation(['transit', 'main', 'od', 'notifications'])(Toolbar);
