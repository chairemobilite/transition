/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

interface LocationColorProps {
    intersectionPolygonColor: string;
    comparisonLocation1Color: string;
    comparisonPolygon1Color: string;
    comparisonLocation2Color: string;
    comparisonPolygon2Color: string;
}

export const LocationModeColorInfo: React.FunctionComponent<LocationColorProps> = (props: LocationColorProps) => {
    const { t } = useTranslation(['transit']);

    return (
        <React.Fragment>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:LocationIntersectionPolygon')}: &nbsp;
                <span style={{ color: props.intersectionPolygonColor }}>&#9673;</span>
            </div>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:LocationN', { locationNumber: '1' })}: &nbsp;
                <span style={{ color: props.comparisonLocation1Color }}>&#9673;</span>
            </div>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:LocationNPolygon', {
                    locationNumber: '1'
                })}
                : &nbsp;
                <span style={{ color: props.comparisonPolygon1Color }}>&#9673;</span>
            </div>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:LocationN', { locationNumber: '2' })}: &nbsp;
                <span style={{ color: props.comparisonLocation2Color }}>&#9673;</span>
            </div>
            <div className="tr__form-section">
                {t('transit:accessibilityComparison:LocationNPolygon', {
                    locationNumber: '2'
                })}
                : &nbsp;
                <span style={{ color: props.comparisonPolygon2Color }}>&#9673;</span>
            </div>
        </React.Fragment>
    );
};

export default LocationModeColorInfo;
