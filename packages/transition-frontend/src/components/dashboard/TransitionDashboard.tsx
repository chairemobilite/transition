/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { PropsWithChildren } from 'react';
import _get from 'lodash/get';
import io from 'socket.io-client';
import { withTranslation, WithTranslation } from 'react-i18next';
import EventEmitter from 'events';
import { sectionLayers } from '../../config/layers.config';

import { MainMapProps } from '../map/types/TransitionMainMapTypes';
import FullSizePanel from 'chaire-lib-frontend/lib/components/dashboard/FullSizePanel';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import Toolbar from 'chaire-lib-frontend/lib/components/dashboard/Toolbar';
import SplitView from 'chaire-lib-frontend/lib/components/dashboard/SplitView';
import LeftMenu from 'chaire-lib-frontend/lib/components/dashboard/MenuBar';
import RightPanel from 'chaire-lib-frontend/lib/components/dashboard/RightPanel';
import BottomPanel from 'chaire-lib-frontend/lib/components/dashboard/BottomPanel';
import EventManager from 'chaire-lib-common/lib/services/events/EventManager';
import KeyboardManager from 'chaire-lib-frontend/lib/services/dashboard/KeyboardManager';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import SelectedObjectsManager from 'chaire-lib-frontend/lib/services/objects/SelectedObjectsManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import NotificationService from 'chaire-lib-common/lib/services/events/Notifications';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import DataSourceCollection from 'chaire-lib-common/lib/services/dataSource/DataSourceCollection';
import PlaceCollection from 'transition-common/lib/services/places/PlaceCollection';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import { loadLayersAndCollections } from '../../services/dashboard/LayersAndCollectionsService';
import {
    Contribution,
    DashboardContribution,
    PanelSectionProps
} from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import SimulationCollection from 'transition-common/lib/services/simulation/SimulationCollection';

interface DashboardProps extends WithTranslation {
    contributions: DashboardContribution[];
    mainMap: React.ComponentType<MainMapProps & PropsWithChildren>;
}

interface DashboardState {
    activeSection: string;
    /**
     * Position of the info panel. Currently, it is right by default. Only other
     * supported option for now is 'left'. So we use special cases for 'left'
     * and put it on the right for any other position.
     *
     * FIXME: Use an enum instead of a string and make sure only those values
     * can be taken.
     */
    infoPanelPosition: string;
    preferencesLoaded: boolean;
    socketConnected: boolean;
    socketWasConnected: boolean;
    showFullSizePanel: boolean;
    mainMapLayerGroups: string[];
    unsavedChangesModalIsOpen: boolean;
    availableRoutingModes: string[];
}

/**
 * TODO: For now, hard code the dashboard for Transition here. But it should be
 * in chaire-lib and offer the possibility to pass the application modules when
 * the API for it has stabilised.
 */
class Dashboard extends React.Component<DashboardProps, DashboardState> {
    private contributions: {
        bottomPanel: Contribution<PanelSectionProps>[];
        menuBar: Contribution<PanelSectionProps>[];
        toolbar: Contribution<PanelSectionProps>[];
        fullSize: Contribution<PanelSectionProps>[];
        rightPanel: Contribution<PanelSectionProps>[];
    };
    socket: any;

    constructor(props: DashboardProps) {
        super(props);

        // this default section will use default preferences because users prefs are not loaded yet.
        // The state will be updated after loading user prefs.
        const activeSection = Preferences.attributes.defaultSection;
        const mainMapLayerGroups = ['transit'];

        this.state = {
            preferencesLoaded: false,
            socketConnected: false,
            socketWasConnected: false,
            showFullSizePanel: false,
            activeSection,
            infoPanelPosition: 'right',
            mainMapLayerGroups,
            unsavedChangesModalIsOpen: false,
            availableRoutingModes: []
        };

        serviceLocator.addService('eventManager', new EventManager(new EventEmitter()));
        serviceLocator.addService('collectionManager', new CollectionManager(serviceLocator.eventManager));
        serviceLocator.addService('selectedObjectsManager', new SelectedObjectsManager(serviceLocator.eventManager));
        serviceLocator.addService('keyboardManager', KeyboardManager);
        serviceLocator.addService('notificationService', new NotificationService());

        serviceLocator.eventManager.emit('progress', { name: 'MapLoading', progress: 0.0 });

        Preferences.addChangeListener(this.onPreferencesChange);

        const allLayoutContribs = props.contributions.flatMap((contrib) => contrib.getLayoutContributions());
        this.contributions = {
            bottomPanel: allLayoutContribs.filter((contrib) => contrib.placement === 'bottomPanel'),
            menuBar: allLayoutContribs.filter((contrib) => contrib.placement === 'menu'),
            toolbar: allLayoutContribs.filter((contrib) => contrib.placement === 'toolbar'),
            fullSize: allLayoutContribs.filter((contrib) => contrib.placement === 'mapOverlay'),
            rightPanel: allLayoutContribs.filter((contrib) => contrib.placement === 'primarySidebar')
        };
    }

    componentDidMount = () => {
        serviceLocator.eventManager.emit('progress', { name: 'MapLoading', progress: 0.0 }); // this does not trigger notification in TopMenu because TopMenu is not yet mounted.
        serviceLocator.eventManager.on('map.loaded', this.onMapLoaded);
        serviceLocator.eventManager.on('fullSizePanel.show', this.onShowFullSizePanel);
        serviceLocator.eventManager.on('fullSizePanel.hide', this.onHideFullSizePanel);
        serviceLocator.eventManager.on('section.change', this.onChangeSection);

        document.addEventListener('keydown', this.handleKeyDown, false);
        document.addEventListener('keyup', this.handleKeyUp, false);

        this.socket = io({
            transports: ['websocket'],
            reconnectionAttempts: 100 //,
            //timeout: 100000
        }).connect();
        this.socket.heartbeatTimeout = 120000;

        this.socket.on('connect', this.socketConnectHandler);
        this.socket.on('disconnect', this.socketDisconnectHandler);
    };

    componentWillUnmount = () => {
        serviceLocator.eventManager.off('map.loaded', this.onMapLoaded);
        serviceLocator.eventManager.off('fullSizePanel.show', this.onShowFullSizePanel);
        serviceLocator.eventManager.off('fullSizePanel.hide', this.onHideFullSizePanel);
        serviceLocator.eventManager.off('section.change', this.onChangeSection);

        document.removeEventListener('keydown', this.handleKeyDown, false);
        document.removeEventListener('keyup', this.handleKeyUp, false);

        this.socket.off('connect', this.socketConnectHandler);
        this.socket.off('disconnect', this.socketDisconnectHandler);
    };

    handleKeyDown = (e: KeyboardEvent) => {
        serviceLocator.keyboardManager.keyDown(e);
    };

    handleKeyUp = (e: KeyboardEvent) => {
        serviceLocator.keyboardManager.keyUp(e);
    };

    onShowFullSizePanel = () => {
        this.setState({ showFullSizePanel: true });
    };

    onHideFullSizePanel = () => {
        this.setState({ showFullSizePanel: false });
    };

    onChangeSection = (section: string, fullSizePanel: boolean) => {
        // Verify if there are unsaved changes
        const selectedObjectsByType = serviceLocator.selectedObjectsManager.getSelections();
        const selectedObjects = Object.values(selectedObjectsByType).flatMap((objects) => objects);
        const selectedObjectsWithChanges = selectedObjects.some((object: any) => {
            // TODO: update the any type with typeguard
            if (object && object.hasChanged && typeof object.hasChanged === 'function' && object.hasChanged()) {
                return true;
            }
            return false;
        });
        if (selectedObjectsWithChanges) {
            this.setState({ unsavedChangesModalIsOpen: true });
        } else {
            serviceLocator.selectedObjectsManager.deselectAll();

            serviceLocator.eventManager.emit('map.handleDrawControl', section);
            serviceLocator.eventManager.emit(
                'map.updateEnabledLayers',
                sectionLayers[section] // will be undefined if section has no layers
            );
            this.setState({ activeSection: section, showFullSizePanel: fullSizePanel });
        }
    };

    onPreferencesChange = (_updates: any) => {
        const infoPanelPosition = Preferences.get('infoPanelPosition');
        this.setState({ infoPanelPosition });
    };

    loadLayersAndCollections = () => {
        if (!this.state.mainMapLayerGroups.includes('transit')) {
            return;
        }
        // TODO: Commented code will be back eventually (soon-ish), keeping it here as a reminder.
        const dataSourceCollection = new DataSourceCollection([], {}, serviceLocator.eventManager);
        const simulationCollection = new SimulationCollection([], {}, serviceLocator.eventManager);

        const nodeCollection = new NodeCollection([], {}, serviceLocator.eventManager);
        //const stationCollection  = new StationCollection([], {}, serviceLocator.eventManager);
        const agencyCollection = new AgencyCollection([], {}, serviceLocator.eventManager);
        const lineCollection = new LineCollection([], {}, serviceLocator.eventManager);
        const pathCollection = new PathCollection([], {}, serviceLocator.eventManager);
        // const unitCollection     = new UnitCollection([], {}, serviceLocator.eventManager);
        // const garageCollection   = new GarageCollection([], {}, serviceLocator.eventManager);

        const serviceCollection = new ServiceCollection([], {}, serviceLocator.eventManager);
        const scenarioCollection = new ScenarioCollection([], {}, serviceLocator.eventManager);
        const placeCollection = new PlaceCollection([], {}, serviceLocator.eventManager);

        // const aggregatedODGeojsonCollection = new AggregatedODGeojsonCollection([], {}, serviceLocator.eventManager);

        loadLayersAndCollections({
            dataSourceCollection,
            simulationCollection,
            nodeCollection,
            agencyCollection,
            lineCollection,
            pathCollection,
            serviceCollection,
            scenarioCollection,
            placeCollection,
            serviceLocator
        });
    };

    socketConnectHandler = () => {
        console.log('SOCKET: connected to socket');
        const socketWasConnected = this.state.socketWasConnected;
        serviceLocator.addService('socketEventManager', new EventManager(this.socket));
        serviceLocator.notificationService.registerEventsOnEmitter(serviceLocator.socketEventManager);

        if (socketWasConnected) {
            this.setState({ socketConnected: true });
        } else {
            // firsty load the preferences, then set socket state to connected, so the main map can get preferences on first load.
            Preferences.load(serviceLocator.socketEventManager).then(() => {
                this.setState({
                    preferencesLoaded: true,
                    socketConnected: true,
                    socketWasConnected: true,
                    activeSection: Preferences.attributes.defaultSection,
                    infoPanelPosition: Preferences.attributes.infoPanelPosition
                });
            });
        }

        // Get available osrm routing modes from server:
        serviceLocator.socketEventManager.emit(
            'service.osrmRouting.availableRoutingModes',
            (availableRoutingModes: string[]) => {
                this.setState({
                    availableRoutingModes
                });
            }
        );
    };

    socketDisconnectHandler = () => {
        console.log('SOCKET: disconnected from socket');
        serviceLocator.notificationService.deregisterEventsOnEmitter(serviceLocator.socketEventManager);
        this.setState({ socketConnected: false });
    };

    onMapLoaded = () => {
        serviceLocator.eventManager.emit('progress', { name: 'MapLoading', progress: 1.0 });
        this.loadLayersAndCollections();
    };

    closeUnsavedChangesModal = (e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        this.setState({
            unsavedChangesModalIsOpen: false
        });
    };

    render() {
        if (!this.state.preferencesLoaded || (!this.state.socketConnected && !this.state.socketWasConnected)) {
            return <LoadingPage />;
        }

        const preferencesMapCenter = _get(Preferences.current, 'map.center', null);
        const mapCenter = preferencesMapCenter;
        const preferencesMapZoom = _get(Preferences.current, 'map.zoom', null);
        const mapZoom = preferencesMapZoom || 10;
        const Map = this.props.mainMap;

        const mapComponent = (
            <Map center={mapCenter} zoom={mapZoom} activeSection={this.state.activeSection}>
                {this.state.showFullSizePanel && (
                    <FullSizePanel
                        activeSection={this.state.activeSection}
                        contributions={this.contributions.fullSize}
                    />
                )}
            </Map>
        );

        const infoPanelComponent = (
            <RightPanel
                activeSection={this.state.activeSection}
                contributions={this.contributions.rightPanel}
                availableRoutingModes={this.state.availableRoutingModes}
            />
        );

        return (
            <React.Fragment>
                {!this.state.socketConnected && this.state.socketWasConnected && (
                    <div className="_container _center _full-width">
                        <p className="_error">{this.props.t('main:connectionIsOffline')}</p>
                    </div>
                )}
                <section
                    id="tr__dashboard"
                    className={!this.state.socketConnected && this.state.socketWasConnected ? '_hide' : ''}
                >
                    <Toolbar activeSection={this.state.activeSection} contributions={this.contributions.toolbar} />
                    <div id="tr__main-container">
                        {/* TODO Should not need to pass the i18n props, anyway, we won't have to pass the Map component as props soon either */}
                        <LeftMenu activeSection={this.state.activeSection} contributions={this.contributions.menuBar} />
                        <SplitView
                            minLeftWidth={this.state.infoPanelPosition === 'left' ? 500 : 150}
                            initialLeftWidth={this.state.infoPanelPosition !== 'left' ? '65%' : '35%'}
                            leftViewID={this.state.infoPanelPosition} // Just has to be something that changes when we switch the info panel position from R to L.
                            hideRightViewWhenResizing={this.state.infoPanelPosition === 'left'}
                            hideLeftViewWhenResizing={this.state.infoPanelPosition !== 'left'}
                            right={this.state.infoPanelPosition !== 'left' ? infoPanelComponent : mapComponent}
                            left={this.state.infoPanelPosition === 'left' ? infoPanelComponent : mapComponent}
                        />
                        {this.state.unsavedChangesModalIsOpen && (
                            <ConfirmModal
                                isOpen={true}
                                title={this.props.t('main:UnsavedChanges')}
                                closeModal={this.closeUnsavedChangesModal}
                                confirmButtonColor="grey"
                                confirmButtonLabel={this.props.t('main:OK')}
                                showCancelButton={false}
                            />
                        )}
                    </div>

                    <BottomPanel
                        activeSection={this.state.activeSection}
                        contributions={this.contributions.bottomPanel}
                    />
                </section>
                <footer>
                    <ul className="_pale">
                        <li>
                            <a href="https://github.com/chairemobilite/transition/">Github</a> •{' '}
                            <a href="https://github.com/chairemobilite/trRouting/">trRouting</a> •{' '}
                        </li>
                    </ul>
                </footer>
            </React.Fragment>
        );
    }
}

export default withTranslation(['main', 'form', 'menu', 'od', 'transit', 'notifications', 'variables'])(Dashboard);
