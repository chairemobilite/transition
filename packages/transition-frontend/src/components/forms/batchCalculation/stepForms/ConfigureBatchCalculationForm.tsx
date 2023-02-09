/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _cloneDeep from 'lodash.clonedeep';

import { _toBool } from 'chaire-lib-common/lib/utils/LodashExtensions';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputMultiselect from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import { isBatchParametersValid, BatchCalculationParameters } from '../../../../services/batchCalculation/types';
import TransitRoutingBaseComponent from '../../transitRouting/widgets/TransitRoutingBaseComponent';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';

export interface ConfigureCalculationParametersFormProps {
    routingParameters: BatchCalculationParameters;
    availableRoutingModes?: string[];
    scenarioCollection: ScenarioCollection;
    onUpdate: (routingParameters: BatchCalculationParameters, isValid: boolean) => void;
}
/**
 * Configure the scenario parameters
 *
 * @param {(ConfigureCalculationParametersFormProps  &
 * WithTranslation)} props
 * @return {*}
 */
const ConfigureCalculationParametersForm: React.FunctionComponent<
    ConfigureCalculationParametersFormProps & WithTranslation
> = (props: ConfigureCalculationParametersFormProps & WithTranslation) => {
    const [updateCnt, setUpdateCnt] = React.useState(0);
    const [errors, setErrors] = React.useState<string[]>([]);

    React.useEffect(() => {
        // validate the data on first load
        const { valid } = isBatchParametersValid(props.routingParameters);
        props.onUpdate(props.routingParameters, valid);
    }, []);

    const onValueChange = (path: keyof BatchCalculationParameters, newValue: { value: any; valid?: boolean }): void => {
        props.routingParameters[path] = newValue.value as never;
        const { valid, errors } = isBatchParametersValid(props.routingParameters);
        props.onUpdate(props.routingParameters, valid);
        setErrors(errors);
        setUpdateCnt(updateCnt + 1);
    };

    const routingModeChoices = React.useMemo(() => {
        const routingModes = _cloneDeep(props.availableRoutingModes || []);
        routingModes.push('transit');
        return routingModes.map((routingMode) => {
            return {
                value: routingMode
            };
        });
    }, [props.availableRoutingModes]);

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
            {routingModeChoices.length > 0 && (
                <InputWrapper twoColumns={false} label={props.t('transit:transitRouting:RoutingModes')}>
                    <InputMultiselect
                        choices={routingModeChoices}
                        t={props.t}
                        id={'formFieldScenarioParametersRoutingModes'}
                        value={props.routingParameters.routingModes}
                        localePrefix="transit:transitPath:routingModes"
                        onValueChange={(e) => onValueChange('routingModes', { value: e.target.value })}
                    />
                </InputWrapper>
            )}
            {props.routingParameters.routingModes.includes('transit') && (
                <React.Fragment>
                    <TransitRoutingBaseComponent onValueChange={onValueChange} attributes={props.routingParameters} />

                    <InputWrapper label={props.t('transit:transitRouting:Scenario')}>
                        <InputSelect
                            id={'formFieldScenarioParametersScenario'}
                            value={props.routingParameters.scenarioId}
                            choices={scenarios}
                            t={props.t}
                            onValueChange={(e) => onValueChange('scenarioId', { value: e.target.value })}
                        />
                    </InputWrapper>
                    <InputWrapper label={props.t('transit:transitRouting:WithAlternatives')}>
                        <InputRadio
                            id={'formFieldScenarioParametersWithAlternatives'}
                            value={props.routingParameters.withAlternatives}
                            sameLine={true}
                            disabled={false}
                            choices={[
                                {
                                    value: true
                                },
                                {
                                    value: false
                                }
                            ]}
                            localePrefix="transit:transitRouting"
                            t={props.t}
                            isBoolean={true}
                            onValueChange={(e) => onValueChange('withAlternatives', { value: _toBool(e.target.value) })}
                        />
                    </InputWrapper>
                </React.Fragment>
            )}
            {errors.length > 0 && <FormErrors errors={errors} />}
        </div>
    );
};

export default withTranslation(['transit', 'main'])(ConfigureCalculationParametersForm);
