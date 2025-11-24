/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import {
    getAllSimulationMethodTypes,
    getSimulationMethodDescriptor
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import OptionsEditComponent from '../widgets/OptionsDescriptorWidgets';
import { PartialSimulationMethodConfiguration } from '../types';

export interface ConfigureSimulationMethodFormProps {
    simulationMethod: PartialSimulationMethodConfiguration;
    onUpdate: (simulationMethod: PartialSimulationMethodConfiguration, isValid: boolean) => void;
}

const ConfigureSimulationMethodForm: React.FunctionComponent<ConfigureSimulationMethodFormProps> = (
    props: ConfigureSimulationMethodFormProps
) => {
    const { t } = useTranslation(['transit', 'main']);
    const [updateCnt, setUpdateCnt] = React.useState(0);
    // FIXME Properly handle errors
    const [errors] = React.useState<string[]>([]);

    React.useEffect(() => {
        // Validate on first load
        props.onUpdate(props.simulationMethod, true);
    }, []);

    const onValueChange = (path: string, newValue: { value: any; valid?: boolean }): void => {
        const pathParts = path.split('.');
        let updatedMethod = { ...props.simulationMethod };

        if (pathParts[0] === 'type') {
            // Reset config when changing type
            updatedMethod = { type: newValue.value, config: {} } as PartialSimulationMethodConfiguration;
        } else if (pathParts[0] === 'config') {
            updatedMethod = {
                ...updatedMethod,
                config: { ...updatedMethod.config, [pathParts[1]]: newValue.value }
            };
        }

        props.onUpdate(updatedMethod, newValue.valid !== false);
    };

    const methodTypes = getAllSimulationMethodTypes();
    const methodChoices = methodTypes.map((methodId) => ({
        value: methodId,
        label: t(getSimulationMethodDescriptor(methodId).getTranslatableName())
    }));

    const methodDescriptor =
        props.simulationMethod.type !== undefined
            ? getSimulationMethodDescriptor(props.simulationMethod.type)
            : undefined;

    return (
        <div className="tr__form-section">
            <InputWrapper smallInput={true} label={t('transit:networkDesign:SimulationMethod')}>
                <InputSelect
                    id={'formFieldSimulationMethodType'}
                    disabled={false}
                    value={props.simulationMethod.type}
                    choices={methodChoices}
                    onValueChange={(e) => onValueChange('type', { value: e.target.value })}
                />
            </InputWrapper>

            {methodDescriptor && (
                <OptionsEditComponent
                    value={props.simulationMethod.config}
                    optionsDescriptor={methodDescriptor}
                    disabled={false}
                    onValueChange={(path, value) => onValueChange(`config.${path}`, value)}
                />
            )}

            {errors.length > 0 && <FormErrors errors={errors} />}
        </div>
    );
};

export default ConfigureSimulationMethodForm;
