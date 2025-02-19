/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { secondsToMinutes } from 'chaire-lib-common/lib/utils/DateTimeUtils';

import { TrRoutingV2 } from 'chaire-lib-common/lib/api/TrRouting';

export interface TransitRoutingStepWalkButtonProps extends WithTranslation {
    step: TrRoutingV2.TripStepWalking;
    stepIndex: number;
    waitingTimeSeconds?: number;
    textColor?: string; //Can be any valid CSS color format: https://www.w3schools.com/css/css_colors.asp
}

const TransitRoutingStepWalkButton: React.FunctionComponent<TransitRoutingStepWalkButtonProps> = (
    props: TransitRoutingStepWalkButtonProps
) => {
    return (
        <React.Fragment key={`walk${props.stepIndex}`}>
            <li className={'_list'} onClick={undefined} key="walk">
                <span className="_list-group _left">
                    <span
                        className="_list-element _strong"
                        style={props.textColor === undefined ? {} : { color: props.textColor }}
                    >
                        {props.t('transit:transitRouting:actions:walking')}
                    </span>
                </span>
                <span className="_list-group _flush-right _right">
                    <span className="_list-element" title={`${props.step.travelTime} ${props.t('main:secondAbbr')}.`}>
                        {secondsToMinutes(props.step.travelTime)} {props.t('main:minuteAbbr')}.
                    </span>
                </span>
                <span className="_list-group _right">
                    <span className="_list-element">{Math.round(props.step.distance)} m</span>
                </span>
            </li>
            <li className="_clear" key="clearer"></li>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(TransitRoutingStepWalkButton);
