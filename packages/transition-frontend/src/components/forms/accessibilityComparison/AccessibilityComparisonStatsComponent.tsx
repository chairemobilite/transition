/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'react-tooltip';
import { ComparisonMode } from './comparisonModes';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';

export interface AccessibilityComparisonStatsComponentProps {
    accessibilityPolygons: {
        result1: GeoJSON.FeatureCollection;
        result2: GeoJSON.FeatureCollection;
    };
    mode: ComparisonMode;
    color1: string;
    color2: string;
}

const AccessibilityComparisonStatsComponent: React.FunctionComponent<AccessibilityComparisonStatsComponentProps> = (
    props: AccessibilityComparisonStatsComponentProps
) => {
    const { t, i18n } = useTranslation(['transit', 'main']);

    const language = i18n.language;

    // State to track show/hide for categories and detailed categories for each duration
    const [showCategoriesState, setShowCategoriesState] = useState<Record<number, boolean>>({});
    const [showEmptyDetailedCategoriesState, setShowEmptyDetailedCategoriesState] = useState<Record<number, boolean>>(
        {}
    );

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

        const durationMinutes = Math.round(properties1.durationMinutes);

        // Get current state for this specific duration
        const showCategories = showCategoriesState[durationMinutes] || false;
        const showEmptyDetailedCategories = showEmptyDetailedCategoriesState[durationMinutes] || false;

        // Helper functions to update state for this specific duration
        const setShowCategories = (value: boolean) => {
            setShowCategoriesState((prev) => ({ ...prev, [durationMinutes]: value }));
        };

        const setShowEmptyDetailedCategories = (value: boolean) => {
            setShowEmptyDetailedCategoriesState((prev) => ({ ...prev, [durationMinutes]: value }));
        };

        // fetch number of accessible places per category and detailed category:
        const accessiblePlacesCountByCategory: JSX.Element[] = [];
        const accessiblePlacesCountByDetailedCategory: JSX.Element[] = [];
        const accessiblePlacesCountByDetailedCategoryEmpty: JSX.Element[] = [];

        let categoryTotal1 = 0;
        let categoryTotal2 = 0;
        if (properties1.accessiblePlacesCountByCategory && properties2.accessiblePlacesCountByCategory) {
            for (const category in properties1.accessiblePlacesCountByCategory) {
                categoryTotal1 += Number(properties1.accessiblePlacesCountByCategory[category]);
                categoryTotal2 += Number(properties2.accessiblePlacesCountByCategory[category]);
                accessiblePlacesCountByCategory.push(
                    <tr key={category}>
                        <th>{t(`main:places:categories:${category}`)}</th>
                        <td>{properties1.accessiblePlacesCountByCategory[category]}</td>
                        <td>{properties2.accessiblePlacesCountByCategory[category]}</td>
                        <td>
                            {(
                                properties2.accessiblePlacesCountByCategory[category] -
                                properties1.accessiblePlacesCountByCategory[category]
                            ).toLocaleString(undefined, { signDisplay: 'exceptZero' })}
                        </td>
                    </tr>
                );
            }
        }
        if (
            properties1.accessiblePlacesCountByDetailedCategory &&
            properties2.accessiblePlacesCountByDetailedCategory
        ) {
            for (const detailedCategory in properties1.accessiblePlacesCountByDetailedCategory) {
                if (
                    properties1.accessiblePlacesCountByDetailedCategory[detailedCategory] > 0 ||
                    properties2.accessiblePlacesCountByDetailedCategory[detailedCategory] > 0
                ) {
                    accessiblePlacesCountByDetailedCategory.push(
                        <tr key={detailedCategory}>
                            <th>{t(`main:places:detailedCategories:${detailedCategory}`)}</th>
                            <td>{properties1.accessiblePlacesCountByDetailedCategory[detailedCategory]}</td>
                            <td>{properties2.accessiblePlacesCountByDetailedCategory[detailedCategory]}</td>
                            <td>
                                {(
                                    properties2.accessiblePlacesCountByDetailedCategory[detailedCategory] -
                                    properties1.accessiblePlacesCountByDetailedCategory[detailedCategory]
                                ).toLocaleString(undefined, { signDisplay: 'exceptZero' })}
                            </td>
                        </tr>
                    );
                } else {
                    accessiblePlacesCountByDetailedCategoryEmpty.push(
                        <tr key={detailedCategory}>
                            <th>{t(`main:places:detailedCategories:${detailedCategory}`)}</th>
                            <td>{properties1.accessiblePlacesCountByDetailedCategory[detailedCategory]}</td>
                            <td>{properties2.accessiblePlacesCountByDetailedCategory[detailedCategory]}</td>
                            <td>
                                {(
                                    properties2.accessiblePlacesCountByDetailedCategory[detailedCategory] -
                                    properties1.accessiblePlacesCountByDetailedCategory[detailedCategory]
                                ).toLocaleString(undefined, { signDisplay: 'exceptZero' })}
                            </td>
                        </tr>
                    );
                }
            }
        }

        return (
            <React.Fragment key={durationMinutes}>
                <tr>
                    <th className="_header">
                        {t('transit:transitRouting:AccessibilityMapAreaTitle', {
                            n: durationMinutes
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
                {typeof properties1.population === 'number' && typeof properties2.population === 'number' && (
                    <tr>
                        <th>{t('transit:transitRouting:AccessibilityMapPopulation')}</th>
                        <td>{properties1.population.toLocaleString(language)}</td>
                        <td>{properties2.population.toLocaleString(language)}</td>
                        <td>
                            {(properties2.population - properties1.population).toLocaleString(language, {
                                signDisplay: 'exceptZero'
                            })}
                        </td>
                    </tr>
                )}
                {(categoryTotal1 > 0 || categoryTotal2 > 0) && (
                    <React.Fragment>
                        <tr>
                            <th className="_header" data-tooltip-id="accessible-POI-header">
                                {t('transit:transitRouting:NumberOfAccessiblePOIsInNMinutesByCategory', {
                                    n: durationMinutes
                                })}
                            </th>
                        </tr>
                        <tr>
                            <th colSpan={4}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <InputCheckboxBoolean
                                        id={`showCategoriesCheckbox${durationMinutes}`}
                                        label={t('transit:transitRouting:SeeCategories')}
                                        isChecked={showCategories}
                                        onValueChange={(e) => setShowCategories(e.target.value)}
                                    />
                                </div>
                            </th>
                        </tr>
                        <tr>
                            <th>{t('transit:transitRouting:TotalPOIs')}</th>
                            <td>{categoryTotal1}</td>
                            <td>{categoryTotal2}</td>
                            <td>
                                {(categoryTotal2 - categoryTotal1).toLocaleString(undefined, {
                                    signDisplay: 'exceptZero'
                                })}
                            </td>
                        </tr>
                        {showCategories && (
                            <React.Fragment>
                                {accessiblePlacesCountByCategory}
                                <tr>
                                    <th className="_header">
                                        {t(
                                            'transit:transitRouting:NumberOfAccessiblePOIsInNMinutesByDetailedCategory',
                                            {
                                                n: durationMinutes
                                            }
                                        )}
                                    </th>
                                </tr>
                                {accessiblePlacesCountByDetailedCategory}
                                <tr>
                                    <th colSpan={4}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <InputCheckboxBoolean
                                                id={`showEmptyDetailedCategoriesCheckbox${durationMinutes}`}
                                                label={t('transit:transitRouting:ShowEmptyDetailedCategories')}
                                                isChecked={showEmptyDetailedCategories}
                                                onValueChange={(e) => setShowEmptyDetailedCategories(e.target.value)}
                                            />
                                        </div>
                                    </th>
                                </tr>
                                {showEmptyDetailedCategories && accessiblePlacesCountByDetailedCategoryEmpty}
                            </React.Fragment>
                        )}
                    </React.Fragment>
                )}
                <br />
            </React.Fragment>
        );
    });

    return (
        <div className="tr__form-section">
            <table className="_statistics" style={{ borderSpacing: '10px 5px' }}>
                <thead>
                    <tr>
                        <th></th>
                        <th style={{ color: props.color1 }}>
                            {props.mode === 'scenarios'
                                ? t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })
                                : t('transit:accessibilityComparison:LocationN', { locationNumber: '1' })}
                        </th>
                        <th style={{ color: props.color2 }}>
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
                <span style={{ color: props.color2 }}>
                    {props.mode === 'scenarios'
                        ? t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })
                        : t('transit:accessibilityComparison:LocationN', { locationNumber: '2' })}
                </span>
                &nbsp;-&nbsp;
                <span style={{ color: props.color1 }}>
                    {props.mode === 'scenarios'
                        ? t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })
                        : t('transit:accessibilityComparison:LocationN', { locationNumber: '1' })}
                </span>
            </Tooltip>
            <Tooltip id="accessible-POI-header" opacity={1} style={{ maxWidth: '90%', zIndex: 100 }}>
                <span>{t('transit:transitRouting:AccessiblePOIsPopup')}</span>
            </Tooltip>
        </div>
    );
};

export default AccessibilityComparisonStatsComponent;
