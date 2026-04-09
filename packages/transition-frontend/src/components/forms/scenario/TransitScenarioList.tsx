/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';

import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import TransitScenario from 'transition-common/lib/services/scenario/Scenario';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import TransitScenarioButton from './TransitScenarioButton';
import ButtonList from '../../parts/ButtonList';
import ToggleableHelp from 'chaire-lib-frontend/lib/components/pageParts/ToggleableHelp';

interface ScenarioListProps {
    scenarioCollection: ScenarioCollection;
    selectedScenario?: Scenario;
}

const TransitScenarioList: React.FunctionComponent<ScenarioListProps> = (props: ScenarioListProps) => {
    const { t } = useTranslation('transit');
    const [checkedScenarios, setCheckedScenarios] = useState<Record<string, boolean>>({});
    const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);

    const newScenario = function () {
        const defaultColor = Preferences.get('transit.scenarios.defaultColor', '#0086FF');
        const newScenario = new TransitScenario({ color: defaultColor }, true, serviceLocator.collectionManager);
        newScenario.startEditing();
        serviceLocator.selectedObjectsManager.setSelection('scenario', [newScenario]);
    };

    const setScenarioCheckedCallback = React.useCallback(
        (scenarioId: string, isChecked: boolean) => {
            setCheckedScenarios((prevCheckedScenarios) => {
                if (isChecked) {
                    return { ...prevCheckedScenarios, [scenarioId]: true };
                } else {
                    const newCheckedScenarios = { ...prevCheckedScenarios };
                    delete newCheckedScenarios[scenarioId];
                    return newCheckedScenarios;
                }
            });
        },
        [setCheckedScenarios]
    );

    const deleteSelected = async () => {
        if (props.scenarioCollection) {
            try {
                serviceLocator.eventManager.emit('progress', {
                    name: 'DeletingSelectedScenarios',
                    progress: 0.0
                });
                await props.scenarioCollection.deleteByIds(
                    Object.keys(checkedScenarios),
                    serviceLocator.socketEventManager
                );
                await props.scenarioCollection.loadFromServer(
                    serviceLocator.socketEventManager,
                    serviceLocator.collectionManager
                );
                serviceLocator.collectionManager.refresh('scenarios');

                setCheckedScenarios({});
            } finally {
                // Make sure to set progress to 1.0 even if there is an error, otherwise the progress bar will be stuck
                serviceLocator.eventManager.emit('progress', {
                    name: 'DeletingSelectedScenarios',
                    progress: 1.0
                });
            }
        }
    };

    const checkScenarioIds = Object.keys(checkedScenarios);
    const hasChecked = checkScenarioIds.length > 0;
    return (
        <div className="tr__list-transit-scenarios-container">
            <div className="tr__section-header-container">
                <h3 className="tr__section-header-container__title">
                    <img
                        src={'/dist/images/icons/transit/scenario_white.svg'}
                        className="_icon"
                        alt={t('transit:transitScenario:Scenario')}
                    />{' '}
                    {t('transit:transitScenario:List')}
                </h3>
                <ToggleableHelp namespace="transit" section="transitScenario" />
            </div>
            <ButtonList key="scenarios">
                {props.scenarioCollection &&
                    props.scenarioCollection
                        .getFeatures()
                        .map((scenario: Scenario) => (
                            <TransitScenarioButton
                                key={scenario.id}
                                scenario={scenario}
                                selectedScenario={props.selectedScenario}
                                isChecked={checkedScenarios[scenario.id] ?? false}
                                setChecked={setScenarioCheckedCallback}
                            />
                        ))}
            </ButtonList>

            {!props.selectedScenario && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faPlus}
                        iconClass="_icon"
                        label={t('transit:transitScenario:New')}
                        onClick={newScenario}
                    />
                    {hasChecked && (
                        <Button
                            color="red"
                            icon={faTrash}
                            iconClass="_icon"
                            label={t('transit:transitScenario:DeleteSelected')}
                            onClick={() => setShowDeleteSelectedModal(true)}
                        />
                    )}
                    {showDeleteSelectedModal && (
                        <ConfirmModal
                            isOpen={true}
                            title={t('transit:transitScenario:ConfirmDeleteSelected', {
                                count: checkScenarioIds.length
                            })}
                            confirmAction={deleteSelected}
                            confirmButtonColor="red"
                            confirmButtonLabel={t('main:Delete')}
                            closeModal={() => setShowDeleteSelectedModal(false)}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default TransitScenarioList;
