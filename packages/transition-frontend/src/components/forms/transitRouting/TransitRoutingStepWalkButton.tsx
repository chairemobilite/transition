/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import { TrRoutingWalkingStep } from 'chaire-lib-common/lib/api/TrRouting';

export interface TransitRoutingStepWalkButtonProps extends WithTranslation {
    step: TrRoutingWalkingStep;
    stepIndex: number;
    waitingTimeSeconds?: number;
}

const TransitRoutingStepWalkButton: React.FunctionComponent<TransitRoutingStepWalkButtonProps> = (
    props: TransitRoutingStepWalkButtonProps
) => {
    return (
        <React.Fragment key={`walk${props.stepIndex}`}>
            <li className={'_list'} onClick={undefined} key="walk">
                <span className="_list-group _left">
                    <span className="_list-element _strong">{props.t('transit:transitRouting:actions:walking')}</span>
                </span>
                <span className="_list-group _flush-right _right">
                    <span
                        className="_list-element"
                        title={`${props.step.travelTimeSeconds} ${props.t('main:secondAbbr')}.`}
                    >
                        {props.step.travelTimeMinutes} {props.t('main:minuteAbbr')}.
                    </span>
                </span>
                <span className="_list-group _right">
                    <span className="_list-element">{Math.round(props.step.distanceMeters)} m</span>
                </span>
            </li>
            <li className="_clear" key="clearer"></li>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(TransitRoutingStepWalkButton);

// export default TransitRoutingStepWalkButton;
