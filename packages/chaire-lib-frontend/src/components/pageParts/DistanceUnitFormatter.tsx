/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import { metersToMiles, metersToFeet } from 'chaire-lib-common/lib/utils/PhysicsUtils';

const destinationUnitOptions = ['km', 'm', 'mi', 'ft'] as const;
type destinationUnitOptionsType = (typeof destinationUnitOptions)[number];

export type DistanceUnitFormatterProps = WithTranslation & {
    value: number;
    sourceUnit: 'km' | 'm';
    destinationUnit?: destinationUnitOptionsType;
};

const DistanceUnitFormatter: React.FunctionComponent<DistanceUnitFormatterProps> = (
    props: DistanceUnitFormatterProps
) => {
    const [destinationUnit, setDestinationUnit] = useState<destinationUnitOptionsType | undefined>(
        props.destinationUnit
    );
    const valueInMeters = props.sourceUnit === 'm' ? props.value : props.value / 1000;

    useEffect(() => {
        // If the destination unit was not specified, we choose the best one based on the magnitude of the value.
        if (destinationUnit === undefined) {
            if (valueInMeters < 1000) {
                setDestinationUnit('m');
            } else {
                setDestinationUnit('km');
            }
        }
    }, [valueInMeters]);

    const unitFormatters: Record<destinationUnitOptionsType, (value: number) => string> = {
        m: (value) => `${roundToDecimals(value, 0)} ${props.t('main:meterAbbr')}`,
        km: (value) => `${roundToDecimals(value / 1000, 2)} ${props.t('main:kilometerAbbr')}`,
        mi: (value) => `${roundToDecimals(metersToMiles(value), 2)} ${props.t('main:mileAbbr')}`,
        ft: (value) => `${roundToDecimals(metersToFeet(value), 0)} ${props.t('main:feetAbbr')}`
    };

    const formattedValue = destinationUnit ? unitFormatters[destinationUnit](valueInMeters) : '';

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

export default withTranslation('main')(DistanceUnitFormatter);
