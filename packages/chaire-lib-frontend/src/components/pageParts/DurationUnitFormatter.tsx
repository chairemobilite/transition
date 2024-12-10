/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { toXXhrYYminZZsec } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';

const destinationUnitOptions = ['hrMinSec', 's', 'm', 'h'] as const;
type destinationUnitOptionsType = (typeof destinationUnitOptions)[number];

export type DurationUnitFormatterProps = WithTranslation & {
    value: number;
    sourceUnit: 's' | 'm' | 'h';
    destinationUnit?: destinationUnitOptionsType;
};

const DurationUnitFormatter: React.FunctionComponent<DurationUnitFormatterProps> = (
    props: DurationUnitFormatterProps
) => {
    const [destinationUnit, setDestinationUnit] = useState<destinationUnitOptionsType | undefined>(
        props.destinationUnit
    );

    const valueInSeconds =
        props.sourceUnit === 's'
            ? props.value
            : props.sourceUnit === 'm'
                ? props.value * 60
                : props.sourceUnit === 'h'
                    ? props.value * 60 * 60
                    : props.value;

    useEffect(() => {
        // If the destination unit was not specified, we choose a default.
        if (destinationUnit === undefined) {
            setDestinationUnit('hrMinSec');
        }
    }, [valueInSeconds]);

    const unitFormatters: Record<destinationUnitOptionsType, (value: number) => string> = {
        hrMinSec: (value) =>
            toXXhrYYminZZsec(value, props.t('main:hourAbbr'), props.t('main:minuteAbbr'), props.t('main:secondAbbr')) ||
            `${value.toString()} ${props.t('main:secondAbbr')}`,
        s: (value) => `${roundToDecimals(value, 2)} ${props.t('main:secondAbbr')}`,
        m: (value) => `${roundToDecimals(value / 60, 2)} ${props.t('main:minuteAbbr')}`,
        h: (value) => `${roundToDecimals(value / 3600, 2)} ${props.t('main:hourAbbr')}`
    };

    const formattedValue = destinationUnit ? unitFormatters[destinationUnit](valueInSeconds) : '';

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

export default withTranslation('main')(DurationUnitFormatter);
