/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { useTranslation } from 'react-i18next';
import PreferencesSectionProps from '../PreferencesSectionProps';
import PreferencesColorComponent from '../PreferencesColorComponent';

const PreferencesSectionAccessibilityComparison: React.FunctionComponent<PreferencesSectionProps> = (
    props: PreferencesSectionProps
) => {
    const { t } = useTranslation(['transit']);

    return (
        <Collapsible trigger={t('transit:accessibilityComparison:Title')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <PreferencesColorComponent
                    {...props}
                    prefPath="transit.routing.transitAccessibilityMap.intersectionLocationColor"
                    label={t('transit:preferences:transitAccessibilityMapComparison:IntersectionLocationColor')}
                />
                <PreferencesColorComponent
                    {...props}
                    prefPath="transit.routing.transitAccessibilityMap.intersectionPolygonColor"
                    label={t('transit:preferences:transitAccessibilityMapComparison:IntersectionPolygonColor')}
                />
                <PreferencesColorComponent
                    {...props}
                    prefPath="transit.routing.transitAccessibilityMap.comparisonLocation1Color"
                    label={t('transit:preferences:transitAccessibilityMapComparison:ComparisonLocationNColor', {
                        locationNumber: '1'
                    })}
                />
                <PreferencesColorComponent
                    {...props}
                    prefPath="transit.routing.transitAccessibilityMap.comparisonPolygon1Color"
                    label={t('transit:preferences:transitAccessibilityMapComparison:ComparisonPolygonNColor', {
                        polygonNumber: '1'
                    })}
                />
                <PreferencesColorComponent
                    {...props}
                    prefPath="transit.routing.transitAccessibilityMap.comparisonLocation2Color"
                    label={t('transit:preferences:transitAccessibilityMapComparison:ComparisonLocationNColor', {
                        locationNumber: '2'
                    })}
                />
                <PreferencesColorComponent
                    {...props}
                    prefPath="transit.routing.transitAccessibilityMap.comparisonPolygon2Color"
                    label={t('transit:preferences:transitAccessibilityMapComparison:ComparisonPolygonNColor', {
                        polygonNumber: '2'
                    })}
                />
            </div>
        </Collapsible>
    );
};

export default PreferencesSectionAccessibilityComparison;
