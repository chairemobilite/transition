/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import { mpsToKph, mpsToMph, mpsToFtps } from 'chaire-lib-common/lib/utils/PhysicsUtils';

const destinationUnitOptions = ['km/h', 'm/s', 'mph', 'ft/s'] as const;
type destinationUnitOptionsType = (typeof destinationUnitOptions)[number];

export type SpeedUnitFormatterProps = WithTranslation & {
    value: number;
    sourceUnit: 'm/s' | 'km/h';
    destinationUnit?: destinationUnitOptionsType;
};

const SpeedUnitFormatter: React.FunctionComponent<SpeedUnitFormatterProps> = (props: SpeedUnitFormatterProps) => {
    const [destinationUnit, setDestinationUnit] = useState<destinationUnitOptionsType | undefined>(
        props.destinationUnit
    );

    const valueInMetersPerSecond = props.sourceUnit === 'm/s' ? props.value : mpsToKph(props.value);

    useEffect(() => {
        // If the destination unit was not specified, we choose a default one.
        if (destinationUnit === undefined) {
            setDestinationUnit('km/h');
        }
    }, [valueInMetersPerSecond]);

    const unitFormatters: Record<destinationUnitOptionsType, (value: number) => string> = {
        'm/s': (value) => `${roundToDecimals(value, 0)} ${props.t('main:mpsAbbr')}`,
        'km/h': (value) => `${roundToDecimals(mpsToKph(value), 1)} ${props.t('main:kphAbbr')}`,
        mph: (value) => `${roundToDecimals(mpsToMph(value), 1)} ${props.t('main:mphAbbr')}`,
        'ft/s': (value) => `${roundToDecimals(mpsToFtps(value), 0)} ${props.t('main:ftpsAbbr')}`
    };

    const formattedValue = destinationUnit ? unitFormatters[destinationUnit](valueInMetersPerSecond) : '';

    const cycleThroughDestinationUnits = () => {
        // Infer the next unit based on the currently displayed unit.
        setDestinationUnit((prevUnit) => {
            return destinationUnitOptions[
                (destinationUnitOptions.indexOf(prevUnit as destinationUnitOptionsType) + 1) %
                    destinationUnitOptions.length
            ];
        });
    };

    return <span onClick={cycleThroughDestinationUnits}>{formattedValue}</span>;
};

export default withTranslation('main')(SpeedUnitFormatter);
