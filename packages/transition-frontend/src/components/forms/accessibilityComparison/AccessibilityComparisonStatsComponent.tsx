/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'react-tooltip';
import * as AccessibilityComparisonConstants from './accessibilityComparisonConstants';
import { ComparisonMode } from './comparisonModes';

export interface AccessibilityComparisonStatsComponentProps {
    accessibilityPolygons: {
        result1: GeoJSON.FeatureCollection;
        result2: GeoJSON.FeatureCollection;
    };
    mode: ComparisonMode;
}

const AccessibilityComparisonStatsComponent: React.FunctionComponent<AccessibilityComparisonStatsComponentProps> = (
    props: AccessibilityComparisonStatsComponentProps
) => {
    const { t, i18n } = useTranslation(['transit', 'main']);

    const language = i18n.language;

    const sortByDuration = (features: GeoJSON.Feature[]) => {
        features.sort((feat1, feat2) => {
            const duration1 = feat1.properties?.durationMinutes;
            const duration2 = feat2.properties?.durationMinutes;
            if (!duration1 || !duration2) {
                return 0;
            }
            return duration1 < duration2 ? -1 : duration1 > duration2 ? 1 : 0;
        });
    };
    const features1 = props.accessibilityPolygons.result1.features;
    sortByDuration(features1);

    const features2 = props.accessibilityPolygons.result2.features;
    sortByDuration(features2);

    const combinedFeatures: { result1: GeoJSON.Feature; result2: GeoJSON.Feature }[] = [];

    features1.forEach((_feature, index) => {
        combinedFeatures.push({
            result1: features1[index],
            result2: features2[index]
        });
    });

    const combinedFeaturesStatsTable = combinedFeatures.map((features) => {
        const properties1 = features.result1.properties;
        const properties2 = features.result2.properties;
        if (!properties1 || !properties2) return null;

        // TODO: The component this file is derived from has a section that is supposed to calculate stats for POI.
        // However, POI import does not work correctly right now, so there is no point in having this section at the moment.
        // In the future, when POI are fixed, add this sections back (use ../accessibilityMap/AccessibilityMapStatsComponent.tsx as reference)

        return (
            <React.Fragment key={properties1.durationMinutes}>
                <tr>
                    <th className="_header">
                        {t('transit:transitRouting:AccessibilityMapAreaTitle', {
                            n: Math.round(properties1.durationMinutes)
                        })}
                    </th>
                </tr>
                <tr>
                    <th>{t('transit:transitRouting:AccessibilityMapAreaSquareKm')}</th>
                    <td>{(Math.round(properties1.areaSqKm * 100) / 100).toLocaleString(language)}</td>
                    <td>{(Math.round(properties2.areaSqKm * 100) / 100).toLocaleString(language)}</td>
                    <td>
                        {(Math.round((properties2.areaSqKm - properties1.areaSqKm) * 100) / 100).toLocaleString(
                            language,
                            { signDisplay: 'exceptZero' }
                        )}
                    </td>
                </tr>
                <tr>
                    <th>{t('transit:transitRouting:AccessibilityMapAreaSquarem')}</th>
                    <td>{Math.round(properties1.areaSqM).toLocaleString(language)}</td>
                    <td>{Math.round(properties2.areaSqM).toLocaleString(language)}</td>
                    <td>
                        {Math.round(properties2.areaSqM - properties1.areaSqM).toLocaleString(language, {
                            signDisplay: 'exceptZero'
                        })}
                    </td>
                </tr>
                {/* TODO: Add more rows when POIs are fixed. */}
            </React.Fragment>
        );
    });

    return (
        <div className="tr__form-section">
            <table className="_statistics" style={{ borderSpacing: '10px' }}>
                <thead>
                    <tr>
                        <th></th>
                        <th style={{ color: AccessibilityComparisonConstants.MAP_1_COLOR }}>
                            {props.mode === 'scenarios'
                                ? t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })
                                : t('transit:accessibilityComparison:LocationN', { locationNumber: '1' })}
                        </th>
                        <th style={{ color: AccessibilityComparisonConstants.MAP_2_COLOR }}>
                            {props.mode === 'scenarios'
                                ? t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })
                                : t('transit:accessibilityComparison:LocationN', { locationNumber: '2' })}
                        </th>
                        <th data-tooltip-id="difference-header">{t('transit:accessibilityComparison:Difference')}</th>
                    </tr>
                </thead>
                <tbody>{combinedFeaturesStatsTable}</tbody>
            </table>
            <Tooltip id="difference-header" opacity={1}>
                <span style={{ color: AccessibilityComparisonConstants.MAP_2_COLOR }}>
                    {props.mode === 'scenarios'
                        ? t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })
                        : t('transit:accessibilityComparison:LocationN', { locationNumber: '2' })}
                </span>
                &nbsp;-&nbsp;
                <span style={{ color: AccessibilityComparisonConstants.MAP_1_COLOR }}>
                    {props.mode === 'scenarios'
                        ? t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })
                        : t('transit:accessibilityComparison:LocationN', { locationNumber: '1' })}
                </span>
            </Tooltip>
        </div>
    );
};

export default AccessibilityComparisonStatsComponent;
