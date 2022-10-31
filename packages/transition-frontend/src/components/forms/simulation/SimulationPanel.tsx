/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import SimulationCollection from 'transition-common/lib/services/simulation/SimulationCollection';
import Simulation from 'transition-common/lib/services/simulation/Simulation';
import SimulationEdit from './SimulationEdit';
import SimulationsList from './SimulationList';

// Using a state object instead of 2 useState hooks because we want this object
// to be modified and cause a re-render if the selection or collection was
// updated, even if the pointer to the collection/selected object do not change.
interface SimulationPanelState {
    simulationCollection: SimulationCollection;
    selectedSimulation?: Simulation;
}

const SimulationsPanel: React.FunctionComponent<WithTranslation> = (props: WithTranslation) => {
    const serviceCollection = serviceLocator.collectionManager.get('services');
    const agencyCollection = serviceLocator.collectionManager.get('agencies');
    const lineCollection = serviceLocator.collectionManager.get('lines');
    const [state, setState] = React.useState<SimulationPanelState>({
        simulationCollection: serviceLocator.collectionManager.get('simulations'),
        selectedSimulation: serviceLocator.selectedObjectsManager.get('simulation')
    });
    const [dataLoaded, setDataLoaded] = React.useState(
        serviceCollection !== undefined && agencyCollection !== undefined && lineCollection !== undefined
    );
    const [_simulationReloaded, setSimulationReloaded] = React.useState(false);

    const onSimulationCollectionUpdate = () =>
        setState(({ selectedSimulation }) => ({
            selectedSimulation,
            simulationCollection: serviceLocator.collectionManager.get('simulations')
        }));
    const onSelectedSimulationUpdate = () =>
        setState(({ simulationCollection }) => ({
            simulationCollection,
            selectedSimulation: serviceLocator.selectedObjectsManager.get('simulation')
        }));
    const onOtherCollectionUpdate = () => {
        const serviceCollection = serviceLocator.collectionManager.get('services');
        const agencyCollection = serviceLocator.collectionManager.get('agencies');
        const lineCollection = serviceLocator.collectionManager.get('lines');
        const isDataLoaded =
            serviceCollection !== undefined && agencyCollection !== undefined && lineCollection !== undefined;
        setDataLoaded(isDataLoaded);
        if (isDataLoaded) {
            serviceLocator.eventManager.off('collection.update.agencies', onOtherCollectionUpdate);
            serviceLocator.eventManager.off('collection.update.services', onOtherCollectionUpdate);
            serviceLocator.eventManager.off('collection.update.lines', onOtherCollectionUpdate);
        }
    };

    React.useEffect(() => {
        serviceLocator.eventManager.on('collection.update.simulations', onSimulationCollectionUpdate);
        serviceLocator.eventManager.on('selected.update.simulation', onSelectedSimulationUpdate);
        serviceLocator.eventManager.on('selected.deselect.simulation', onSelectedSimulationUpdate);
        // Reload the service collections at mount time, to make sure it is up to date
        if (state.simulationCollection) {
            state.simulationCollection
                .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager)
                .then(() => {
                    setSimulationReloaded(true);
                });
        }
        if (!dataLoaded) {
            serviceLocator.eventManager.on('collection.update.agencies', onOtherCollectionUpdate);
            serviceLocator.eventManager.on('collection.update.services', onOtherCollectionUpdate);
            serviceLocator.eventManager.on('collection.update.lines', onOtherCollectionUpdate);
        }
        return () => {
            serviceLocator.eventManager.off('collection.update.simulations', onSimulationCollectionUpdate);
            serviceLocator.eventManager.off('selected.update.simulation', onSelectedSimulationUpdate);
            serviceLocator.eventManager.off('selected.deselect.simulation', onSelectedSimulationUpdate);
            serviceLocator.eventManager.off('collection.update.agencies', onOtherCollectionUpdate);
            serviceLocator.eventManager.off('collection.update.services', onOtherCollectionUpdate);
            serviceLocator.eventManager.off('collection.update.lines', onOtherCollectionUpdate);
        };
    }, []);

    return (
        <div id="tr__form-transit-simulations-panel" className="tr__form-transit-simulations-panel tr__panel">
            {!state.selectedSimulation && dataLoaded && (
                <SimulationsList
                    selectedSimulation={state.selectedSimulation}
                    simulationCollection={state.simulationCollection}
                />
            )}

            {state.selectedSimulation && (
                <SimulationEdit
                    simulation={state.selectedSimulation}
                    simulationCollection={state.simulationCollection}
                />
            )}
        </div>
    );
};

export default withTranslation(['transit', 'main', 'form'])(SimulationsPanel);
