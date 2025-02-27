/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

import Simulation from 'transition-common/lib/services/simulation/Simulation';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import SimulationCollection from 'transition-common/lib/services/simulation/SimulationCollection';
import SimulationButton from './SimulationButton';
import ButtonList from '../../parts/ButtonList';

interface SimulationListProps extends WithTranslation {
    simulationCollection: SimulationCollection;
    selectedSimulation?: Simulation;
}

const SimulationList: React.FunctionComponent<SimulationListProps> = (props: SimulationListProps) => {
    const newSimulation = function () {
        const defaultColor = Preferences.get('transit.simulations.defaultColor', '#0086FF');
        const newSimulation = new Simulation({ color: defaultColor }, true, serviceLocator.collectionManager);
        newSimulation.startEditing();
        serviceLocator.selectedObjectsManager.setSelection('simulation', [newSimulation]);
    };

    return (
        <div className="tr__list-simulations-container">
            <h3>
                <img
                    src={'/dist/images/icons/interface/simulation_white.svg'}
                    className="_icon"
                    alt={props.t('transit:simulation:List')}
                />{' '}
                {props.t('transit:simulation:List')}
            </h3>
            <ButtonList key="simulations">
                {props.simulationCollection &&
                    props.simulationCollection
                        .getFeatures()
                        .map((simulation: Simulation) => (
                            <SimulationButton
                                key={simulation.id}
                                simulation={simulation}
                                selectedSimulation={props.selectedSimulation}
                            />
                        ))}
            </ButtonList>

            {!props.selectedSimulation && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faPlus}
                        iconClass="_icon"
                        label={props.t('transit:simulation:New')}
                        onClick={newSimulation}
                    />
                </div>
            )}
        </div>
    );
};

export default withTranslation('transit')(SimulationList);
