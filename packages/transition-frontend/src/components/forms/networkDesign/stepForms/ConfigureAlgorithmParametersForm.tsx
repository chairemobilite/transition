/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import { AlgorithmConfiguration, getAlgorithmDescriptor } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { getDefaultOptionsFromDescriptor } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import TransitNetworkDesignAlgorithmComponent from '../widgets/TransitNetworkDesignAlgorithmComponent';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { PartialAlgorithmConfiguration } from '../types';

export interface ConfigureAlgorithmParametersFormProps {
    algorithmConfig: PartialAlgorithmConfiguration;
    onUpdate: (algorithmConfig: PartialAlgorithmConfiguration, isValid: boolean) => void;
}

const ConfigureAlgorithmParametersForm: React.FunctionComponent<ConfigureAlgorithmParametersFormProps> = (
    props: ConfigureAlgorithmParametersFormProps
) => {
    const [updateCnt, setUpdateCnt] = React.useState(0);
    // FIXME Properly handle errors
    const [errors] = React.useState<string[]>([]);

    React.useEffect(() => {
        // FIXME Should validate properly
        const algoDescriptor = props.algorithmConfig?.type ? getAlgorithmDescriptor(props.algorithmConfig.type) : undefined;
        // FIXME This part of setting the defaults should be done by the options component
        if (algoDescriptor) {
            const updatedAlgoConfig = getDefaultOptionsFromDescriptor(props.algorithmConfig.config || {}, algoDescriptor)
            props.onUpdate({ ...props.algorithmConfig, config: updatedAlgoConfig }, true);
            return;
        }
        // Validate on first load - algorithm component handles validation
        props.onUpdate(props.algorithmConfig, true);
    }, []);

    const onValueChange = (path: 'type' | 'config', newValue: { value: any; valid?: boolean }): void => {
        let updatedConfig = { ...props.algorithmConfig };

        if (path === 'type') {
            updatedConfig = { ...updatedConfig, type: newValue.value };
        } else if (path === 'config') {
            updatedConfig = {
                ...updatedConfig,
                config: newValue.value
            };
        }

        // The algorithm component handles validation internally
        props.onUpdate(updatedConfig, newValue.valid !== false);
    };

    return (
        <div className="tr__form-section">
            <TransitNetworkDesignAlgorithmComponent
                key={`algorithm${updateCnt}`}
                algorithmConfig={props.algorithmConfig as AlgorithmConfiguration}
                disabled={false}
                onValueChange={onValueChange}
            />
            {errors.length > 0 && <FormErrors errors={errors} />}
        </div>
    );
};

export default ConfigureAlgorithmParametersForm;
