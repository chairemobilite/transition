/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faFileUpload } from '@fortawesome/free-solid-svg-icons/faFileUpload';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionDownloadButtons from 'chaire-lib-frontend/lib/components/pageParts/CollectionDownloadButtons';
import CollectionSaveToCacheButtons from '../../parts/CollectionSaveToCacheButtons';
import ScenarioEdit from './TransitScenarioEdit';
import ScenariosList from './TransitScenarioList';
import ScenariosImportForm from './TransitScenarioImportForm';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import Scenario from 'transition-common/lib/services/scenario/Scenario';

// Using a state object instead of 2 useState hooks because we want this object
// to be modified and cause a re-render if the selection or collection was
// updated, even if the pointer to the collection/selected object do not change.
interface ScenarioPanelState {
    scenarioCollection: ScenarioCollection;
    selectedScenario?: Scenario;
}

const ScenarioPanel: React.FunctionComponent<WithTranslation> = (props: WithTranslation) => {
    const [importerSelected, setImporterSelected] = React.useState(false);
    const [state, setState] = React.useState<ScenarioPanelState>({
        scenarioCollection: serviceLocator.collectionManager.get('scenarios'),
        selectedScenario: serviceLocator.selectedObjectsManager.get('scenario')
    });

    React.useEffect(() => {
        const onScenarioCollectionUpdate = () =>
            setState(({ selectedScenario }) => ({
                selectedScenario,
                scenarioCollection: serviceLocator.collectionManager.get('scenarios')
            }));
        const onSelectedScenarioUpdate = () =>
            setState(({ scenarioCollection }) => ({
                scenarioCollection,
                selectedScenario: serviceLocator.selectedObjectsManager.get('scenario')
            }));
        serviceLocator.eventManager.on('collection.update.scenarios', onScenarioCollectionUpdate);
        serviceLocator.eventManager.on('selected.update.scenario', onSelectedScenarioUpdate);
        serviceLocator.eventManager.on('selected.deselect.scenario', onSelectedScenarioUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.scenarios', onScenarioCollectionUpdate);
            serviceLocator.eventManager.off('selected.update.scenario', onSelectedScenarioUpdate);
            serviceLocator.eventManager.off('selected.deselect.scenario', onSelectedScenarioUpdate);
        };
    }, []);

    return (
        <div id="tr__form-transit-scenarios-panel" className="tr__form-transit-scenarios-panel tr__panel">
            {!state.selectedScenario && !importerSelected && (
                <ScenariosList
                    selectedScenario={state.selectedScenario}
                    scenarioCollection={state.scenarioCollection}
                />
            )}

            {state.selectedScenario && !importerSelected && <ScenarioEdit scenario={state.selectedScenario} />}

            {!state.selectedScenario && importerSelected && (
                <ScenariosImportForm setImporterSelected={setImporterSelected} />
            )}

            {!state.selectedScenario && !importerSelected && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faFileUpload}
                        iconClass="_icon"
                        label={props.t('transit:transitScenario:ImportFromJson')}
                        onClick={() => setImporterSelected(true)}
                    />
                </div>
            )}

            {!state.selectedScenario && !importerSelected && (
                <React.Fragment>
                    <CollectionSaveToCacheButtons
                        collection={state.scenarioCollection}
                        labelPrefix={'transit:transitScenario'}
                    />
                    <CollectionDownloadButtons collection={state.scenarioCollection} />
                </React.Fragment>
            )}
        </div>
    );
};

export default withTranslation('transit')(ScenarioPanel);
