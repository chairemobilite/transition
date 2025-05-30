/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

import TransitScenario from 'transition-common/lib/services/scenario/Scenario';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import TransitScenarioButton from './TransitScenarioButton';
import ButtonList from '../../parts/ButtonList';
import ToggleableHelp from 'chaire-lib-frontend/lib/components/pageParts/ToggleableHelp';

interface ScenarioListProps extends WithTranslation {
    scenarioCollection: ScenarioCollection;
    selectedScenario?: Scenario;
}

const TransitScenarioList: React.FunctionComponent<ScenarioListProps> = (props: ScenarioListProps) => {
    const newScenario = function () {
        const defaultColor = Preferences.get('transit.scenarios.defaultColor', '#0086FF');
        const newScenario = new TransitScenario({ color: defaultColor }, true, serviceLocator.collectionManager);
        newScenario.startEditing();
        serviceLocator.selectedObjectsManager.setSelection('scenario', [newScenario]);
    };

    return (
        <div className="tr__list-transit-scenarios-container">
            <div className="tr__section-header-container">
                <h3 className="tr__section-header-container__title">
                    <img
                        src={'/dist/images/icons/transit/scenario_white.svg'}
                        className="_icon"
                        alt={props.t('transit:transitScenario:Scenario')}
                    />{' '}
                    {props.t('transit:transitScenario:List')}
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
                            />
                        ))}
            </ButtonList>

            {!props.selectedScenario && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faPlus}
                        iconClass="_icon"
                        label={props.t('transit:transitScenario:New')}
                        onClick={newScenario}
                    />
                </div>
            )}
        </div>
    );
};

export default withTranslation('transit')(TransitScenarioList);
