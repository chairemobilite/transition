/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Simulation from 'transition-common/lib/services/simulation/Simulation';
import SimulationRun, { SimulationRunAttributes } from 'transition-common/lib/services/simulation/SimulationRun';
import ButtonList from '../../../parts/ButtonList';
import SimulationRunButton from './SimulationRunButton';
import SimulationRunDetail from './SimulationRunDetail';

interface SimulationRunListProps extends WithTranslation {
    simulation: Simulation;
}

const SimulationRunList: React.FunctionComponent<SimulationRunListProps> = (props: SimulationRunListProps) => {
    const [simulationRuns, setSimulationRuns] = useState<SimulationRun[]>([]);
    const [selected, setSelected] = useState<SimulationRun | undefined>(undefined);
    const [runUpdate, setRunUpdate] = useState(0);

    React.useEffect(() => {
        serviceLocator.socketEventManager.emit(
            'simulation.getSimulationRuns',
            props.simulation.getId(),
            ({ simulationRuns }: { simulationRuns: SimulationRunAttributes[] }) => {
                setSimulationRuns(simulationRuns.map((attribs) => new SimulationRun(attribs, false)));
            }
        );
    }, [runUpdate]);

    return (
        <div className="tr__list-transit-simulations-container">
            <h3>
                <img
                    src={'/dist/images/icons/transit/service_white.svg'}
                    className="_icon"
                    alt={props.t('transit:simulation:SimulationRuns')}
                />{' '}
                {props.t('transit:simulation:SimulationRuns')}
            </h3>
            <ButtonList key="simulationruns">
                {simulationRuns.map((simulationRun: SimulationRun) => (
                    <SimulationRunButton
                        key={simulationRun.id}
                        simulationRun={simulationRun}
                        isSelected={selected !== undefined && selected.getId() === simulationRun.getId()}
                        setSelected={setSelected}
                        updateList={() => setRunUpdate(runUpdate + 1)}
                    />
                ))}
            </ButtonList>

            {selected !== undefined && <SimulationRunDetail simulationRun={selected} />}
        </div>
    );
};

export default withTranslation('transit')(SimulationRunList);
