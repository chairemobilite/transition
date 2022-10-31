/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import SimulationRun, { SimulationRunAttributes } from 'transition-common/lib/services/simulation/SimulationRun';
import InputText from 'chaire-lib-frontend/lib/components/input/InputText';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';

interface SimulationRunDetailProps extends WithTranslation {
    simulationRun: SimulationRun;
}

const SimulationRunDetail: React.FunctionComponent<SimulationRunDetailProps> = (props: SimulationRunDetailProps) => {
    const [simulationRun, setSimulationRun] = React.useState<SimulationRun | undefined>(undefined);

    React.useEffect(() => {
        serviceLocator.socketEventManager.emit(
            'simulationRun.read',
            props.simulationRun.getId(),
            undefined,
            ({ simulationRun }: { simulationRun: SimulationRunAttributes }) => {
                setSimulationRun(new SimulationRun(simulationRun, false));
            }
        );
    }, [props.simulationRun]);

    if (simulationRun === undefined) {
        // TODO Add a loading state
        return null;
    }

    return (
        <React.Fragment>
            <InputWrapper label={props.t('transit:simulation:RuntimeOptions')} twoColumns={false}>
                <InputText
                    id={`simulationRunOptions${simulationRun.getId()}`}
                    disabled={true}
                    rows={10}
                    value={JSON.stringify(simulationRun.attributes.options, null, 3)}
                />
            </InputWrapper>
            <InputWrapper label={props.t('transit:simulation:Results')} twoColumns={false}>
                <InputText
                    id={`simulationRunResults${simulationRun.getId()}`}
                    disabled={true}
                    rows={10}
                    value={JSON.stringify(simulationRun.attributes.results, null, 3)}
                />
            </InputWrapper>
            <InputWrapper label={props.t('transit:simulation:Parameters')} twoColumns={false}>
                <InputText
                    id={`simulationRunParameters${simulationRun.getId()}`}
                    disabled={true}
                    rows={10}
                    value={JSON.stringify(simulationRun.attributes.data, null, 3)}
                />
            </InputWrapper>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main', 'form', 'notifications'])(SimulationRunDetail);
