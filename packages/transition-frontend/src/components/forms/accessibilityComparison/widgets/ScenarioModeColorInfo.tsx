/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import AccessibilityComparisonColorPicker from './AccessibilityComparisonColorPicker';

interface ScenarioColorProps {
    intersectionLocationColor: string;
    intersectionPolygonColor: string;
    comparisonPolygon1Color: string;
    comparisonPolygon2Color: string;
    onValueChange: (colorToChange: string, newColor: string) => void;
}

export const ScenarioModeColorInfo: React.FunctionComponent<ScenarioColorProps> = (props: ScenarioColorProps) => {
    const { t } = useTranslation(['transit']);

    return (
        <React.Fragment>
            <AccessibilityComparisonColorPicker
                defaultColor={props.intersectionLocationColor}
                label={t('transit:accessibilityComparison:ScenarioLocation')}
                colorValue={props.intersectionLocationColor}
                onValueChange={(newColor) => {
                    props.onValueChange('intersectionLocationColor', newColor);
                }}
            />
            <AccessibilityComparisonColorPicker
                defaultColor={props.intersectionPolygonColor}
                label={t('transit:accessibilityComparison:ScenarioIntersectionPolygon')}
                colorValue={props.intersectionPolygonColor}
                onValueChange={(newColor) => {
                    props.onValueChange('intersectionPolygonColor', newColor);
                }}
            />
            <AccessibilityComparisonColorPicker
                defaultColor={props.comparisonPolygon1Color}
                label={t('transit:accessibilityComparison:ScenarioNPolygon', {
                    scenarioNumber: '1'
                })}
                colorValue={props.comparisonPolygon1Color}
                onValueChange={(newColor) => {
                    props.onValueChange('comparisonPolygon1Color', newColor);
                }}
            />
            <AccessibilityComparisonColorPicker
                defaultColor={props.comparisonPolygon2Color}
                label={t('transit:accessibilityComparison:ScenarioNPolygon', {
                    scenarioNumber: '2'
                })}
                colorValue={props.comparisonPolygon2Color}
                onValueChange={(newColor) => {
                    props.onValueChange('comparisonPolygon1Color', newColor);
                }}
            />
        </React.Fragment>
    );
};

export default ScenarioModeColorInfo;
