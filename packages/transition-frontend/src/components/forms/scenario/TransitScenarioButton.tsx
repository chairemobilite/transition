/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';

interface ScenarioButtonProps extends WithTranslation {
    scenario: Scenario;
    selectedScenario?: Scenario;
}

const TransitScenarioButton: React.FunctionComponent<ScenarioButtonProps> = (props: ScenarioButtonProps) => {
    const scenarioIsSelected =
        (props.selectedScenario && props.selectedScenario.getId() === props.scenario.getId()) || false;

    const onSelect: React.MouseEventHandler = (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        props.scenario.startEditing();
        serviceLocator.selectedObjectsManager.select('scenario', props.scenario);
    };

    const onDelete: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        await props.scenario.delete(serviceLocator.socketEventManager);
        if (scenarioIsSelected) {
            serviceLocator.selectedObjectsManager.deselect('scenario');
        }
        serviceLocator.collectionManager.refresh('scenarios');
    };

    const onDuplicate: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        const newAttributes = props.scenario.getClonedAttributes(true);
        const duplicateScenario = new Scenario(newAttributes, true, serviceLocator.collectionManager);
        duplicateScenario.set('name', `${props.scenario.attributes.name} (${props.t('main:copy')})`);

        await duplicateScenario.save(serviceLocator.socketEventManager);
        serviceLocator.collectionManager.refresh('scenarios');
    };

    const isFrozen = props.scenario.isFrozen();

    return (
        <Button
            key={props.scenario.getId()}
            isSelected={scenarioIsSelected}
            flushActionButtons={true}
            onSelect={{ handler: onSelect }}
            onDuplicate={{ handler: onDuplicate, altText: props.t('transit:transitScenario:DuplicateScenario') }}
            onDelete={
                !isFrozen && !scenarioIsSelected
                    ? {
                        handler: onDelete,
                        message: props.t('transit:transitScenario:ConfirmDelete'),
                        altText: props.t('transit:transitScenario:Delete')
                    }
                    : undefined
            }
        >
            <ButtonCell alignment="left">
                <span className="_circle-button" style={{ backgroundColor: props.scenario.attributes.color }}></span>
            </ButtonCell>
            {isFrozen && (
                <ButtonCell alignment="left">
                    <img
                        className="_icon-alone"
                        src={'/dist/images/icons/interface/lock_white.svg'}
                        alt={props.t('main:Locked')}
                    />
                </ButtonCell>
            )}
            <ButtonCell alignment="left">{props.scenario.attributes.name}</ButtonCell>
        </Button>
    );
};

export default withTranslation(['transit', 'main'])(TransitScenarioButton);
