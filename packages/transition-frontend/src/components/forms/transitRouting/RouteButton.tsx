/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';

import { secondsToMinutes } from 'chaire-lib-common/lib/utils/DateTimeUtils';

export interface RouteButtonProps extends WithTranslation {
    travelTimeSeconds: number;
    distanceMeters: number;
    routingMode: RoutingOrTransitMode;
}

const RouteButton: React.FunctionComponent<RouteButtonProps> = (props: RouteButtonProps) => {
    return (
        <React.Fragment key={'walkOnlyContainer'}>
            <li className={'_list'} onClick={undefined} key="walkOnly">
                <span className="_list-group _left">
                    <span className="_list-element _strong">
                        {props.t(`transit:transitPath:routingModes:${props.routingMode}`)}
                    </span>
                </span>
                <span className="_list-group _flush-right _right">
                    <span className="_list-element" title={`${props.travelTimeSeconds} ${props.t('main:secondAbbr')}.`}>
                        {secondsToMinutes(props.travelTimeSeconds, Math.round)} {props.t('main:minuteAbbr')}.
                    </span>
                </span>
                <span className="_list-group _right">
                    <span className="_list-element">{Math.round(props.distanceMeters)} m</span>
                </span>
            </li>
            <li className="_clear" key="clearer"></li>
        </React.Fragment>
    );
};

//export default TransitRoutingWalkOnlyButton;
export default withTranslation(['transit', 'main'])(RouteButton);
