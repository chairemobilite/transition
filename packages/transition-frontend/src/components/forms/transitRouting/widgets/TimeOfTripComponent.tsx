/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import {
    secondsSinceMidnightToTimeStr,
    timeStrToSecondsSinceMidnight
} from 'chaire-lib-common/lib/utils/DateTimeUtils';

export interface TimeOfTripComponentProps extends WithTranslation {
    departureTimeSecondsSinceMidnight?: number;
    arrivalTimeSecondsSinceMidnight?: number;
    onValueChange: (time: { value: any; valid?: boolean }, timeType: 'departure' | 'arrival') => void;
}

// TODO Make a widget with combo "DepartAt/ArriveBy" and a time selector
const TimeOfTripComponent: React.FunctionComponent<TimeOfTripComponentProps> = (props: TimeOfTripComponentProps) => {
    return (
        <React.Fragment>
            <InputWrapper smallInput={true} label={props.t('transit:transitRouting:DepartureTime')}>
                <InputStringFormatted
                    id={'formFieldTransitRoutingDepartureTime'}
                    value={props.departureTimeSecondsSinceMidnight}
                    onValueUpdated={(value) => props.onValueChange(value, 'departure')}
                    stringToValue={timeStrToSecondsSinceMidnight}
                    valueToString={secondsSinceMidnightToTimeStr}
                    pattern="[0-9]{1,2}:[0-9]{2}"
                />
            </InputWrapper>
            <InputWrapper smallInput={true} label={props.t('transit:transitRouting:ArrivalTime')}>
                <InputStringFormatted
                    id={'formFieldTransitRoutingArrivalTime'}
                    value={props.arrivalTimeSecondsSinceMidnight}
                    onValueUpdated={(value) => props.onValueChange(value, 'arrival')}
                    stringToValue={timeStrToSecondsSinceMidnight}
                    valueToString={secondsSinceMidnightToTimeStr}
                    pattern="[0-9]{1,2}:[0-9]{2}"
                />
            </InputWrapper>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(TimeOfTripComponent);
