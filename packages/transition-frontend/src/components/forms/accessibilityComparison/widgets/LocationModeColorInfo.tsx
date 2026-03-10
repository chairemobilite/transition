/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import AccessibilityComparisonColorPicker from './AccessibilityComparisonColorPicker';

interface LocationColorProps {
    intersectionPolygonColor: string;
    comparisonLocation1Color: string;
    comparisonPolygon1Color: string;
    comparisonLocation2Color: string;
    comparisonPolygon2Color: string;
    onValueChange: (colorToChange: string, newColor: string) => void;
}

export const LocationModeColorInfo: React.FunctionComponent<LocationColorProps> = (props: LocationColorProps) => {
    const { t } = useTranslation(['transit']);

    return (
        <React.Fragment>
            <AccessibilityComparisonColorPicker
                defaultColor={props.intersectionPolygonColor}
                label={t('transit:accessibilityComparison:LocationIntersectionPolygon')}
                colorValue={props.intersectionPolygonColor}
                onValueChange={(newColor) => {
                    props.onValueChange('intersectionPolygonColor', newColor);
                }}
            />
            <AccessibilityComparisonColorPicker
                defaultColor={props.comparisonLocation1Color}
                label={t('transit:accessibilityComparison:LocationN', { locationNumber: '1' })}
                colorValue={props.comparisonLocation1Color}
                onValueChange={(newColor) => {
                    props.onValueChange('comparisonLocation1Color', newColor);
                }}
            />
            <AccessibilityComparisonColorPicker
                defaultColor={props.comparisonPolygon1Color}
                label={t('transit:accessibilityComparison:LocationNPolygon', {
                    locationNumber: '1'
                })}
                colorValue={props.comparisonPolygon1Color}
                onValueChange={(newColor) => {
                    props.onValueChange('comparisonPolygon1Color', newColor);
                }}
            />
            <AccessibilityComparisonColorPicker
                defaultColor={props.comparisonLocation2Color}
                label={t('transit:accessibilityComparison:LocationN', { locationNumber: '2' })}
                colorValue={props.comparisonLocation2Color}
                onValueChange={(newColor) => {
                    props.onValueChange('comparisonLocation2Color', newColor);
                }}
            />
            <AccessibilityComparisonColorPicker
                defaultColor={props.comparisonPolygon2Color}
                label={t('transit:accessibilityComparison:LocationNPolygon', {
                    locationNumber: '2'
                })}
                colorValue={props.comparisonPolygon2Color}
                onValueChange={(newColor) => {
                    props.onValueChange('comparisonPolygon2Color', newColor);
                }}
            />
        </React.Fragment>
    );
};

export default LocationModeColorInfo;
