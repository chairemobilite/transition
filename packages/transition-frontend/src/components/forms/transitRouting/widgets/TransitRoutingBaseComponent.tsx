/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _toString from 'lodash.tostring';

import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { TransitRoutingBaseAttributes } from 'transition-common/lib/services/transitRouting/TransitRoutingQueryAttributes';
import { secondsToMinutes, minutesToSeconds } from 'chaire-lib-common/lib/utils/DateTimeUtils';

export interface TransitRoutingBaseComponentProps extends WithTranslation {
    attributes: TransitRoutingBaseAttributes;
    disabled?: boolean;
    onValueChange: (path: keyof TransitRoutingBaseAttributes, newValue: { value: any; valid?: boolean }) => void;
}

const TransitRoutingBaseComponent: React.FunctionComponent<TransitRoutingBaseComponentProps> = (
    props: TransitRoutingBaseComponentProps
) => {
    const disabled = props.disabled === undefined ? false : props.disabled;
    return (
        <React.Fragment>
            <InputWrapper smallInput={true} label={props.t('transit:transitRouting:MaximumTotalTravelTimeMinutes')}>
                <InputStringFormatted
                    id={'formFieldTransitRoutingMaximumTotalTravelTimeMinutes'}
                    disabled={disabled}
                    value={props.attributes.maxTotalTravelTimeSeconds}
                    onValueUpdated={(value) => props.onValueChange('maxTotalTravelTimeSeconds', value)}
                    stringToValue={minutesToSeconds}
                    valueToString={(val) => _toString(secondsToMinutes(val))}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper
                smallInput={true}
                label={props.t('transit:transitRouting:MinimumWaitingTimeMinutes')}
                help={props.t('transit:transitRouting:MinimumWaitingTimeMinutesHelp')}
            >
                <InputStringFormatted
                    id={'formFieldTransitRoutingMinimumWaitingTimeMinutes'}
                    disabled={disabled}
                    value={props.attributes.minWaitingTimeSeconds}
                    onValueUpdated={(value) => props.onValueChange('minWaitingTimeSeconds', value)}
                    stringToValue={minutesToSeconds}
                    valueToString={(val) => _toString(secondsToMinutes(val))}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper
                smallInput={true}
                label={props.t('transit:transitRouting:MaximumAccessEgressTravelTimeMinutes')}
                help={props.t('transit:transitRouting:MaximumAccessEgressTravelTimeMinutesHelp')}
            >
                <InputStringFormatted
                    id={'formFieldTransitRoutingMaximumAccessEgressTravelTimeMinutes'}
                    disabled={disabled}
                    value={props.attributes.maxAccessEgressTravelTimeSeconds}
                    onValueUpdated={(value) => props.onValueChange('maxAccessEgressTravelTimeSeconds', value)}
                    stringToValue={minutesToSeconds}
                    valueToString={(val) => _toString(secondsToMinutes(val))}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper
                smallInput={true}
                label={props.t('transit:transitRouting:MaximumTransferTravelTimeMinutes')}
                help={props.t('transit:transitRouting:MaximumTransferTravelTimeMinutesHelp')}
            >
                <InputStringFormatted
                    id={'formFieldTransitRoutingMaximumTransferTravelTimeMinutes'}
                    disabled={disabled}
                    value={props.attributes.maxTransferTravelTimeSeconds}
                    onValueUpdated={(value) => props.onValueChange('maxTransferTravelTimeSeconds', value)}
                    stringToValue={minutesToSeconds}
                    valueToString={(val) => _toString(secondsToMinutes(val))}
                    type={'number'}
                />
            </InputWrapper>
            <InputWrapper
                smallInput={true}
                label={props.t('transit:transitRouting:MaximumFirstWaitingTimeMinutes')}
                help={props.t('transit:transitRouting:MaximumFirstWaitingTimeMinutesHelp')}
            >
                <InputStringFormatted
                    id={'formFieldTransitRoutingMaximumFirstWaitingTimeMinutes'}
                    disabled={disabled}
                    value={props.attributes.maxFirstWaitingTimeSeconds}
                    onValueUpdated={(value) => props.onValueChange('maxFirstWaitingTimeSeconds', value)}
                    stringToValue={minutesToSeconds}
                    valueToString={(val) => _toString(secondsToMinutes(val))}
                    type={'number'}
                />
            </InputWrapper>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(TransitRoutingBaseComponent);
