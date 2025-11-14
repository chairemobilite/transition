/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import { AlgorithmConfiguration } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import TransitNetworkDesignAlgorithmComponent from '../widgets/TransitNetworkDesignAlgorithmComponent';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';

export interface ConfigureAlgorithmParametersFormProps {
    algorithmConfig: AlgorithmConfiguration;
    onUpdate: (algorithmConfig: AlgorithmConfiguration, isValid: boolean) => void;
}

const ConfigureAlgorithmParametersForm: React.FunctionComponent<
    ConfigureAlgorithmParametersFormProps
> = (props: ConfigureAlgorithmParametersFormProps) => {
    const [updateCnt, setUpdateCnt] = React.useState(0);
    const [errors, setErrors] = React.useState<string[]>([]);

    React.useEffect(() => {
        // Validate on first load - algorithm component handles validation
        props.onUpdate(props.algorithmConfig, true);
    }, []);

    const onValueChange = (path: string, newValue: { value: any; valid?: boolean }): void => {
        const pathParts = path.split('.');
        let updatedConfig = { ...props.algorithmConfig };

        if (pathParts[0] === 'type') {
            updatedConfig = { ...updatedConfig, type: newValue.value };
        } else if (pathParts[0] === 'config') {
            updatedConfig = {
                ...updatedConfig,
                config: { ...updatedConfig.config, [pathParts[1]]: newValue.value }
            };
        }

        // The algorithm component handles validation internally
        props.onUpdate(updatedConfig, newValue.valid !== false);
        setUpdateCnt(updateCnt + 1);
    };

    return (
        <div className="tr__form-section">
            <TransitNetworkDesignAlgorithmComponent
                key={`algorithm${updateCnt}`}
                algorithmConfig={props.algorithmConfig}
                disabled={false}
                onValueChange={onValueChange}
            />
            {errors.length > 0 && <FormErrors errors={errors} />}
        </div>
    );
};

export default ConfigureAlgorithmParametersForm;
