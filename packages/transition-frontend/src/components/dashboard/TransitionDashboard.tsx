/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import _get from 'lodash/get';
import io from 'socket.io-client';
import { useTranslation } from 'react-i18next';
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

type DashboardProps = {
    contributions: DashboardContribution[];
    mainMap: React.ComponentType<MainMapProps & React.PropsWithChildren<object>>;
}

type ContributionGroups = {
    bottomPanel: Contribution<PanelSectionProps>[];
    menuBar: Contribution<PanelSectionProps>[];
    toolbar: Contribution<PanelSectionProps>[];
    fullSize: Contribution<PanelSectionProps>[];
    rightPanel: Contribution<PanelSectionProps>[];
}

const Dashboard: React.FC<DashboardProps> = ({ contributions, mainMap }) => {
    const { t } = useTranslation(['main', 'form', 'menu', 'od', 'transit', 'notifications', 'variables']);

    // Get initial state values from preferences
    const initialActiveSection = Preferences.getAttributes().defaultSection as string;
    const initialInfoPanelPosition = Preferences.getAttributes().infoPanelPosition as string;

    // State
    const [preferencesLoaded, setPreferencesLoaded] = useState<boolean>(false);
    const [socketConnected, setSocketConnected] = useState<boolean>(false);
    const [socketWasConnected, setSocketWasConnected] = useState<boolean>(false);
    const [showFullSizePanel, setShowFullSizePanel] = useState<boolean>(false);
    const [activeSection, setActiveSection] = useState<string>(initialActiveSection);
    const [infoPanelPosition, setInfoPanelPosition] = useState<string>(initialInfoPanelPosition || 'right');
    const [mainMapLayerGroups] = useState<string[]>(['transit']);
    const [unsavedChangesModalIsOpen, setUnsavedChangesModalIsOpen] = useState<boolean>(false);
    const [availableRoutingModes, setAvailableRoutingModes] = useState<string[]>([]);

    // Socket ref to persist across renders
    const socketRef = useRef<any | null>(null);

    // Setup contribution groups
    const contributionGroups = useRef<ContributionGroups>({
        bottomPanel: [],
        menuBar: [],
        toolbar: [],
        fullSize: [],
        rightPanel: []
    });

    // Initialize services
    useEffect(() => {
        // Initialize service locator with required services
        serviceLocator.addService('eventManager', new EventManager(new EventEmitter()));
        serviceLocator.addService('collectionManager', new CollectionManager(serviceLocator.eventManager));
        serviceLocator.addService('selectedObjectsManager', new SelectedObjectsManager(serviceLocator.eventManager));
        serviceLocator.addService('keyboardManager', KeyboardManager);
        serviceLocator.addService('notificationService', new NotificationService());

        // Setup contribution groups
        const allLayoutContribs = contributions.flatMap((contrib) => contrib.getLayoutContributions());
        contributionGroups.current = {
            bottomPanel: allLayoutContribs.filter((contrib) => contrib.placement === 'bottomPanel'),
            menuBar: allLayoutContribs.filter((contrib) => contrib.placement === 'menu'),
            toolbar: allLayoutContribs.filter((contrib) => contrib.placement === 'toolbar'),
            fullSize: allLayoutContribs.filter((contrib) => contrib.placement === 'mapOverlay'),
            rightPanel: allLayoutContribs.filter((contrib) => contrib.placement === 'primarySidebar')
        };

        // Initial progress event
        serviceLocator.eventManager.emit('progress', { name: 'MapLoading', progress: 0.0 });

        // Add preferences change listener
        Preferences.addChangeListener(onPreferencesChange);

        // Cleanup function
        return () => {
            Preferences.removeChangeListener(onPreferencesChange);
        };
    }, [contributions]);

    // Setup event listeners and socket connection
    useEffect(() => {
        // Register event listeners
        serviceLocator.eventManager.emit('progress', { name: 'MapLoading', progress: 0.0 });
        serviceLocator.eventManager.on('map.loaded', onMapLoaded);
        serviceLocator.eventManager.on('fullSizePanel.show', onShowFullSizePanel);
        serviceLocator.eventManager.on('fullSizePanel.hide', onHideFullSizePanel);
        serviceLocator.eventManager.on('section.change', onChangeSection);

        // Register keyboard event handlers
        document.addEventListener('keydown', handleKeyDown, false);
        document.addEventListener('keyup', handleKeyUp, false);

        // Setup socket connection
        socketRef.current = io({
            transports: ['websocket'],
            reconnectionAttempts: 100,
            timeout: 120000  // Use timeout instead of heartbeatTimeout
        }).connect();

        if (socketRef.current) {
            socketRef.current.on('connect', socketConnectHandler);
            socketRef.current.on('disconnect', socketDisconnectHandler);
        }

        // Cleanup function
        return () => {
            serviceLocator.eventManager.off('map.loaded', onMapLoaded);
            serviceLocator.eventManager.off('fullSizePanel.show', onShowFullSizePanel);
            serviceLocator.eventManager.off('fullSizePanel.hide', onHideFullSizePanel);
            serviceLocator.eventManager.off('section.change', onChangeSection);

            document.removeEventListener('keydown', handleKeyDown, false);
            document.removeEventListener('keyup', handleKeyUp, false);

            if (socketRef.current) {
                socketRef.current.off('connect', socketConnectHandler);
                socketRef.current.off('disconnect', socketDisconnectHandler);
                socketRef.current.disconnect();
            }
        };
    }, []);

    // Keyboard event handlers
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        serviceLocator.keyboardManager.keyDown(e);
    }, []);

    const handleKeyUp = useCallback((e: KeyboardEvent) => {
        serviceLocator.keyboardManager.keyUp(e);
    }, []);

    // Panel visibility handlers
    const onShowFullSizePanel = useCallback(() => {
        setShowFullSizePanel(true);
    }, []);

    const onHideFullSizePanel = useCallback(() => {
        setShowFullSizePanel(false);
    }, []);

    // Section change handler
    const onChangeSection = useCallback((section: string, fullSizePanel: boolean) => {
        // Verify if there are unsaved changes
        const selectedObjectsByType = serviceLocator.selectedObjectsManager.getSelections();
        const selectedObjects = Object.values(selectedObjectsByType).flatMap((objects) => objects);
        const selectedObjectsWithChanges = selectedObjects.some((object: any) => {
            // Check if object has changed
            if (object && object.hasChanged && typeof object.hasChanged === 'function' && object.hasChanged()) {
                return true;
            }
            return false;
        });

        if (selectedObjectsWithChanges) {
            setUnsavedChangesModalIsOpen(true);
        } else {
            serviceLocator.selectedObjectsManager.deselectAll();

            serviceLocator.eventManager.emit('map.handleDrawControl', section);
            serviceLocator.eventManager.emit(
                'map.updateEnabledLayers',
                sectionLayers[section] // will be undefined if section has no layers
            );

            setActiveSection(section);
            setShowFullSizePanel(fullSizePanel);
        }
    }, []);

    // Preferences change handler
    const onPreferencesChange = useCallback((_updates: any) => {
        const newInfoPanelPosition = Preferences.get('infoPanelPosition');
        setInfoPanelPosition(newInfoPanelPosition);
    }, []);

    // Load layers and collections
    const loadLayersAndCollectionsHandler = useCallback(() => {
        if (!mainMapLayerGroups.includes('transit')) {
            return;
        }

        // Create collections
        const dataSourceCollection = new DataSourceCollection([], {}, serviceLocator.eventManager);
        const simulationCollection = new SimulationCollection([], {}, serviceLocator.eventManager);
        const nodeCollection = new NodeCollection([], {}, serviceLocator.eventManager);
        const agencyCollection = new AgencyCollection([], {}, serviceLocator.eventManager);
        const lineCollection = new LineCollection([], {}, serviceLocator.eventManager);
        const pathCollection = new PathCollection([], {}, serviceLocator.eventManager);
        const serviceCollection = new ServiceCollection([], {}, serviceLocator.eventManager);
        const scenarioCollection = new ScenarioCollection([], {}, serviceLocator.eventManager);
        const placeCollection = new PlaceCollection([], {}, serviceLocator.eventManager);

        // Load layers and collections
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
    }, [mainMapLayerGroups]);

    // Socket connection handlers
    const socketConnectHandler = useCallback(() => {
        console.log('SOCKET: connected to socket');

        if (socketRef.current) {
            serviceLocator.addService('socketEventManager', new EventManager(socketRef.current));
            serviceLocator.notificationService.registerEventsOnEmitter(serviceLocator.socketEventManager);
        }

        if (socketWasConnected) {
            setSocketConnected(true);
        } else {
            // First load the preferences, then set socket state to connected
            Preferences.load(serviceLocator.socketEventManager).then(() => {
                setPreferencesLoaded(true);
                setSocketConnected(true);
                setSocketWasConnected(true);
                setActiveSection(Preferences.getAttributes().defaultSection);
                setInfoPanelPosition(Preferences.getAttributes().infoPanelPosition);
            });
        }

        // Get available OSRM routing modes from server
        serviceLocator.socketEventManager.emit(
            'service.osrmRouting.availableRoutingModes',
            (routingModes: string[]) => {
                setAvailableRoutingModes(routingModes);
            }
        );
    }, [socketWasConnected]);

    const socketDisconnectHandler = useCallback(() => {
        console.log('SOCKET: disconnected from socket');
        if (serviceLocator.socketEventManager) {
            serviceLocator.notificationService.deregisterEventsOnEmitter(serviceLocator.socketEventManager);
        }
        setSocketConnected(false);
    }, []);

    // Map loaded handler
    const onMapLoaded = useCallback(() => {
        serviceLocator.eventManager.emit('progress', { name: 'MapLoading', progress: 1.0 });
        loadLayersAndCollectionsHandler();
    }, [loadLayersAndCollectionsHandler]);

    // Close unsaved changes modal
    const closeUnsavedChangesModal = useCallback((e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        setUnsavedChangesModalIsOpen(false);
    }, []);

    // Loading screen
    if (!preferencesLoaded || (!socketConnected && !socketWasConnected)) {
        return <LoadingPage />;
    }

    // Prepare map configuration
    const preferencesMapCenter = _get(Preferences.current, 'map.center', null) as [number, number];
    const mapCenter = preferencesMapCenter;
    const preferencesMapZoom = _get(Preferences.current, 'map.zoom', null) as number;
    const mapZoom = preferencesMapZoom || 10;
    const Map = mainMap;

    // Prepare components
    const mapComponent = (
        <Map center={mapCenter} zoom={mapZoom} activeSection={activeSection}>
            {showFullSizePanel && (
                <FullSizePanel
                    activeSection={activeSection}
                    contributions={contributionGroups.current.fullSize}
                />
            )}
        </Map>
    );

    const infoPanelComponent = (
        <RightPanel
            activeSection={activeSection}
            contributions={contributionGroups.current.rightPanel}
            availableRoutingModes={availableRoutingModes}
        />
    );

    return (
        <React.Fragment>
            {!socketConnected && socketWasConnected && (
                <div className="_container _center _full-width">
                    <p className="_error">{t('main:connectionIsOffline')}</p>
                </div>
            )}
            <section
                id="tr__dashboard"
                className={!socketConnected && socketWasConnected ? '_hide' : ''}
            >
                <Toolbar activeSection={activeSection} contributions={contributionGroups.current.toolbar} />
                <div id="tr__main-container">
                    <LeftMenu activeSection={activeSection} contributions={contributionGroups.current.menuBar} />
                    <SplitView
                        minLeftWidth={infoPanelPosition === 'left' ? 500 : 150}
                        initialLeftWidth={infoPanelPosition === 'right' ? '65%' : '35%'}
                        leftViewID={infoPanelPosition} // Just has to be something that changes when we switch the info panel position from R to L.
                        hideRightViewWhenResizing={infoPanelPosition === 'left'}
                        hideLeftViewWhenResizing={infoPanelPosition === 'right'}
                        right={infoPanelPosition === 'right' ? infoPanelComponent : mapComponent}
                        left={infoPanelPosition === 'left' ? infoPanelComponent : mapComponent}
                    />
                    {unsavedChangesModalIsOpen && (
                        <ConfirmModal
                            isOpen={true}
                            title={t('main:UnsavedChanges')}
                            closeModal={closeUnsavedChangesModal}
                            confirmButtonColor="grey"
                            confirmButtonLabel={t('main:OK')}
                            showCancelButton={false}
                        />
                    )}
                </div>

                <BottomPanel
                    activeSection={activeSection}
                    contributions={contributionGroups.current.bottomPanel}
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
};

export default Dashboard;
