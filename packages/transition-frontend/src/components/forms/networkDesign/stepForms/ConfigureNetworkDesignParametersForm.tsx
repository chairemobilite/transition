/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import {
    TransitNetworkDesignParameters,
    validateTransitNetworkDesignParameters
} from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import TransitNetworkDesignParametersComponent from '../widgets/TransitNetworkDesignParametersComponent';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';

export interface ConfigureNetworkDesignParametersFormProps {
    parameters: TransitNetworkDesignParameters;
    onUpdate: (parameters: TransitNetworkDesignParameters, isValid: boolean) => void;
}

const ConfigureNetworkDesignParametersForm: React.FunctionComponent<ConfigureNetworkDesignParametersFormProps> = (
    props: ConfigureNetworkDesignParametersFormProps
) => {
    const [errors, setErrors] = React.useState<string[]>([]);

    React.useEffect(() => {
        // Validate on first load
        const { valid, errors } = validateTransitNetworkDesignParameters(props.parameters);
        props.onUpdate(props.parameters, valid);
        setErrors(errors);
    }, []);

    const onValueChange = (
        path: keyof TransitNetworkDesignParameters,
        newValue: { value: any; valid?: boolean }
    ): void => {
        const updatedParameters = { ...props.parameters, [path]: newValue.value };
        const { valid, errors } = validateTransitNetworkDesignParameters(updatedParameters);

        props.onUpdate(updatedParameters, valid);
        setErrors(errors);
    };

    return (
        <div className="tr__form-section">
            <TransitNetworkDesignParametersComponent
                key={'transitNetworkDesignParams'}
                attributes={props.parameters}
                disabled={false}
                onValueChange={onValueChange}
            />
            {errors.length > 0 && <FormErrors errors={errors} />}
        </div>
    );
};

export default ConfigureNetworkDesignParametersForm;
