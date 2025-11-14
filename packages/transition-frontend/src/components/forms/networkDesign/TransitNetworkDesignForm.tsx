/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { TransitNetworkDesignParameters } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import { AlgorithmConfiguration } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { SimulationMethodConfiguration } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';

export interface TransitNetworkDesignFormProps {
    initialValues?: {
        parameters: {
            transitNetworkDesignParameters: TransitNetworkDesignParameters;
            algorithmConfiguration: AlgorithmConfiguration;
            simulationMethod: SimulationMethodConfiguration;
        };
    };
    onJobConfigurationCompleted: () => void;
}

const TransitNetworkDesignForm: React.FunctionComponent<TransitNetworkDesignFormProps> = (
    _props: TransitNetworkDesignFormProps
) => {
    const { t } = useTranslation();

    return (
        <form id={'tr__form-transit-network-design-new'} className="apptr__form">
            <h3>
                <img
                    src={'/dist/images/icons/interface/simulation_white.svg'}
                    className="_icon"
                    alt={t('transit:networkDesign:New')}
                />{' '}
                {t('transit:networkDesign:New')}
            </h3>
            To be implemented
        </form>
    );
};

export default TransitNetworkDesignForm;
