/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import {
    TransitNetworkDesignParameters,
    transitNetworkDesignDescriptor
} from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import OptionsEditComponent from '../widgets/OptionsDescriptorWidgets';
import { getDefaultOptionsFromDescriptor } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';

export interface ConfigureNetworkDesignParametersFormProps {
    parameters: Partial<TransitNetworkDesignParameters>;
    onUpdate: (parameters: Partial<TransitNetworkDesignParameters>, isValid: boolean) => void;
}

const ConfigureNetworkDesignParametersForm: React.FunctionComponent<ConfigureNetworkDesignParametersFormProps> = (
    props: ConfigureNetworkDesignParametersFormProps
) => {
    return (
        <div className="tr__form-section">
            <OptionsEditComponent
                value={props.parameters}
                optionsDescriptor={transitNetworkDesignDescriptor}
                disabled={false}
                onUpdate={props.onUpdate}
            />
        </div>
    );
};

export default ConfigureNetworkDesignParametersForm;
