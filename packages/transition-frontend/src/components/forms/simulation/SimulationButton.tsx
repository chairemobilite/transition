/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Simulation from 'transition-common/lib/services/simulation/Simulation';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';

interface SimulationButtonProps extends WithTranslation {
    simulation: Simulation;
    selectedSimulation?: Simulation;
}

const SimulationButton: React.FunctionComponent<SimulationButtonProps> = (props: SimulationButtonProps) => {
    const simulationIsSelected =
        (props.selectedSimulation && props.selectedSimulation.getId() === props.simulation.getId()) || false;

    const onSelect: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        props.simulation.startEditing();
        serviceLocator.selectedObjectsManager.setSelection('simulation', [props.simulation]);
    };

    const onDelete: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        await props.simulation.delete(serviceLocator.socketEventManager);
        if (simulationIsSelected) {
            serviceLocator.selectedObjectsManager.deselect('simulation');
        }
        serviceLocator.collectionManager.refresh('simulations');
    };

    const onDuplicate: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        const simulation = props.simulation;
        serviceLocator.eventManager.emit('progress', { name: 'SavingSimulation', progress: 0.0 });

        // clone simulation
        const newAttributes = simulation.getClonedAttributes();
        newAttributes.name = `${newAttributes.name} (${props.t('main:copy')})`;
        const duplicatedSimulation = new Simulation(newAttributes, true, serviceLocator.collectionManager);

        await duplicatedSimulation.save(serviceLocator.socketEventManager);

        serviceLocator.collectionManager.refresh('simulations');
        serviceLocator.eventManager.emit('progress', { name: 'SavingSimulation', progress: 1.0 });
    };

    const simulationId = props.simulation.getId();
    const isFrozen = props.simulation.isFrozen();

    return (
        <Button
            key={simulationId}
            isSelected={simulationIsSelected}
            onSelect={{ handler: onSelect }}
            onDuplicate={{ handler: onDuplicate, altText: props.t('transit:simulation:DuplicateSimulation') }}
            onDelete={
                !isFrozen && !simulationIsSelected
                    ? {
                        handler: onDelete,
                        message: props.t('transit:simulation:ConfirmDelete'),
                        altText: props.t('main:Delete')
                    }
                    : undefined
            }
            flushActionButtons={true}
        >
            <ButtonCell alignment="left">
                <span
                    className="_circle-button"
                    style={{ backgroundColor: props.simulation.getAttributes().color }}
                ></span>
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
            <ButtonCell alignment="left">{props.simulation.toString()}</ButtonCell>
        </Button>
    );
};

export default withTranslation(['transit', 'main', 'notifications'])(SimulationButton);
