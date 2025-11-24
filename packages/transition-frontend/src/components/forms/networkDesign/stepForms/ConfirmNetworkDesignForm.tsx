/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _toString from 'lodash/toString';

import { TransitNetworkDesignParameters } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import {
    AlgorithmConfiguration,
    getAlgorithmDescriptor
} from 'transition-common/lib/services/networkDesign/transit/algorithm';
import {
    SimulationMethodConfiguration,
    getSimulationMethodDescriptor
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod';

export interface ConfirmNetworkDesignFormProps {
    parameters: {
        transitNetworkDesignParameters: TransitNetworkDesignParameters;
        algorithmConfiguration: AlgorithmConfiguration;
        simulationMethod: SimulationMethodConfiguration;
    };
}

const ConfirmNetworkDesignForm: React.FunctionComponent<ConfirmNetworkDesignFormProps> = (
    props: ConfirmNetworkDesignFormProps
) => {
    const { t } = useTranslation(['transit', 'main']);
    const { transitNetworkDesignParameters, algorithmConfiguration, simulationMethod } = props.parameters;

    return (
        <div className="tr__form-section">
            <table className="_statistics" key="confirmNetworkDesignProperties">
                <tbody>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {t('transit:networkDesign:NetworkDesignParameters')}
                        </th>
                    </tr>
                    <tr>
                        <th>{t('transit:simulation:NumberOfLinesMin')}</th>
                        <td>{_toString(transitNetworkDesignParameters.numberOfLinesMin || '-')}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:simulation:NumberOfLinesMax')}</th>
                        <td>{_toString(transitNetworkDesignParameters.numberOfLinesMax || '-')}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:simulation:MaxIntervalMinutes')}</th>
                        <td>{_toString(transitNetworkDesignParameters.maxTimeBetweenPassages || '-')}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:simulation:MinIntervalMinutes')}</th>
                        <td>{_toString(transitNetworkDesignParameters.minTimeBetweenPassages || '-')}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:simulation:VehiclesCount')}</th>
                        <td>{_toString(transitNetworkDesignParameters.nbOfVehicles || '-')}</td>
                    </tr>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {t('transit:networkDesign:AlgorithmConfiguration')}
                        </th>
                    </tr>
                    <tr>
                        <th>{t('transit:networkDesign:Algorithm')}</th>
                        <td>{t(getAlgorithmDescriptor(algorithmConfiguration.type).getTranslatableName())}</td>
                    </tr>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {t('transit:networkDesign:SimulationMethod')}
                        </th>
                    </tr>
                    <tr>
                        <th>{t('transit:networkDesign:SimulationMethod')}</th>
                        <td>{t(getSimulationMethodDescriptor(simulationMethod.type).getTranslatableName())}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default ConfirmNetworkDesignForm;
