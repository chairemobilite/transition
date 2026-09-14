/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ScenarioColorProps {
    intersectionLocationColor: string;
    intersectionPolygonColor: string;
    comparisonPolygon1Color: string;
    comparisonPolygon2Color: string;
}

export const ScenarioModeColorInfo: React.FunctionComponent<ScenarioColorProps> = (props: ScenarioColorProps) => {
    const { t } = useTranslation(['transit']);

    return (
        <React.Fragment>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:ScenarioLocation')}: &nbsp;
                <span style={{ color: props.intersectionLocationColor }}>&#9673;</span>
            </div>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:ScenarioIntersectionPolygon')}: &nbsp;
                <span style={{ color: props.intersectionPolygonColor }}>&#9673;</span>
            </div>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:ScenarioNPolygon', {
                    scenarioNumber: '1'
                })}
                : &nbsp;
                <span style={{ color: props.comparisonPolygon1Color }}>&#9673;</span>
            </div>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:ScenarioNPolygon', {
                    scenarioNumber: '2'
                })}
                : &nbsp;
                <span style={{ color: props.comparisonPolygon2Color }}>&#9673;</span>
            </div>
        </React.Fragment>
    );
};

export default ScenarioModeColorInfo;
