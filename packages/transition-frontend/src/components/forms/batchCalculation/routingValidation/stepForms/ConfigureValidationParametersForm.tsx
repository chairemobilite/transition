/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _toString from 'lodash/toString';

import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import {
    isBatchParametersValid,
    BatchCalculationParameters
} from 'transition-common/lib/services/batchCalculation/types';
import TransitRoutingBaseComponent from '../../../transitRouting/widgets/TransitRoutingBaseComponent';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';

export interface ConfigureValidationParametersFormProps {
    // FIXME Wrong type, we should have a type for the validation parameters with the buffer
    validationParameters: BatchCalculationParameters;
    availableRoutingModes?: string[];
    scenarioCollection: ScenarioCollection;
    onUpdate: (validationParameters: BatchCalculationParameters, isValid: boolean) => void;
}

/**
 * Configure the validation parameters
 *
 * @param {(ConfigureValidationParametersFormProps)} props
 * @return {*}
 */
const ConfigureValidationParametersForm: React.FunctionComponent<ConfigureValidationParametersFormProps> = (
    props: ConfigureValidationParametersFormProps
) => {
    const [updateCnt, setUpdateCnt] = React.useState(0);
    const [errors, setErrors] = React.useState<string[]>([]);
    const [bufferMinutes, setBufferMinutes] = React.useState(15); // Default buffer of 15 minutes
    const { t } = useTranslation('transit');

    React.useEffect(() => {
        // Validate the data on first load
        const { valid } = isBatchParametersValid(props.validationParameters);
        props.onUpdate(props.validationParameters, valid);
    }, []);

    const onValueChange = (path: keyof BatchCalculationParameters, newValue: { value: any; valid?: boolean }): void => {
        props.validationParameters[path] = newValue.value as never;
        const { valid, errors } = isBatchParametersValid(props.validationParameters);
        props.onUpdate(props.validationParameters, valid);
        setErrors(errors);
        setUpdateCnt(updateCnt + 1);
    };

    const onBufferValueChange = (value: { value: number; valid?: boolean }): void => {
        setBufferMinutes(value.value);
        setUpdateCnt(updateCnt + 1);
    };

    const scenarios = React.useMemo(
        () =>
            props.scenarioCollection.features.map((scenario) => ({
                value: scenario.id,
                label: scenario.toString(false)
            })),
        [props.scenarioCollection]
    );

    return (
        <div className="tr__form-section">
            <TransitRoutingBaseComponent onValueChange={onValueChange} attributes={props.validationParameters} />

            <InputWrapper label={t('transit:transitRouting:Scenario')}>
                <InputSelect
                    id={'formFieldScenarioParametersScenario'}
                    value={props.validationParameters.scenarioId}
                    choices={scenarios}
                    t={t}
                    onValueChange={(e) => onValueChange('scenarioId', { value: e.target.value })}
                />
            </InputWrapper>

            <InputWrapper smallInput={true} label={t('transit:batchCalculation:TripBuffer')}>
                <InputStringFormatted
                    id={'formFieldTransitBatchRoutingBufferMinutes'}
                    value={bufferMinutes}
                    onValueUpdated={onBufferValueChange}
                    stringToValue={_toInteger}
                    valueToString={_toString}
                    type={'number'}
                />
            </InputWrapper>

            {errors.length > 0 && <FormErrors errors={errors} />}
        </div>
    );
};

export default ConfigureValidationParametersForm;
