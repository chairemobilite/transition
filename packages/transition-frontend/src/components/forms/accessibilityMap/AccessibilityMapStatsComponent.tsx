/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
export interface AccessibilityMapStatsComponentProps extends WithTranslation {
    accessibilityPolygons: GeoJSON.FeatureCollection;
}

const AccessibilityMapStatsComponent: React.FunctionComponent<AccessibilityMapStatsComponentProps> = (
    props: AccessibilityMapStatsComponentProps
) => {
    const features = props.accessibilityPolygons.features;
    features.sort((feat1, feat2) => {
        const duration1 = feat1.properties?.durationMinutes;
        const duration2 = feat2.properties?.durationMinutes;
        if (!duration1 || !duration2) {
            return 0;
        }
        return duration1 < duration2 ? -1 : duration1 > duration2 ? 1 : 0;
    });

    const featureStats = features.map((feature) => {
        const properties = feature.properties;
        if (!properties) return null;

        // fetch number of accessible places per category and detailed category:
        const accessiblePlacesCountByCategory: JSX.Element[] = [];
        const accessiblePlacesCountByDetailedCategory: JSX.Element[] = [];
        let atLeastOneCategoryNotEmpty = false;
        if (properties.accessiblePlacesCountByCategory) {
            for (const category in properties.accessiblePlacesCountByCategory) {
                if (properties.accessiblePlacesCountByCategory[category] > 0) {
                    atLeastOneCategoryNotEmpty = true;
                }
                accessiblePlacesCountByCategory.push(
                    <tr key={category}>
                        <th>{props.t(`main:places:categories:${category}`)}</th>
                        <td>{properties.accessiblePlacesCountByCategory[category]}</td>
                    </tr>
                );
            }
        }
        if (properties.accessiblePlacesCountByDetailedCategory) {
            for (const detailedCategory in properties.accessiblePlacesCountByDetailedCategory) {
                if (properties.accessiblePlacesCountByDetailedCategory[detailedCategory] > 0) {
                    accessiblePlacesCountByDetailedCategory.push(
                        <tr key={detailedCategory}>
                            <th>{props.t(`main:places:detailedCategories:${detailedCategory}`)}</th>
                            <td>{properties.accessiblePlacesCountByDetailedCategory[detailedCategory]}</td>
                        </tr>
                    );
                }
            }
        }

        return (
            <table className="_statistics" key={properties.durationMinutes}>
                <tbody>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {props.t('transit:transitRouting:AccessibilityMapAreaTitle', {
                                n: Math.round(properties.durationMinutes)
                            })}
                        </th>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:AccessibilityMapAreaSquareKm')}</th>
                        <td>{Math.round(properties.areaSqKm * 100) / 100}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:AccessibilityMapAreaSquarem')}</th>
                        <td>{Math.round(properties.areaSqM)}</td>
                    </tr>
                    {atLeastOneCategoryNotEmpty && (
                        <tr>
                            <th colSpan={2} className="_header">
                                {props.t('transit:transitRouting:NumberOfAccessiblePOIsByCategory')}
                            </th>
                        </tr>
                    )}
                    {atLeastOneCategoryNotEmpty && accessiblePlacesCountByCategory}
                    {accessiblePlacesCountByDetailedCategory.length > 0 && (
                        <tr>
                            <th colSpan={2} className="_header">
                                {props.t('transit:transitRouting:NumberOfAccessiblePOIsByDetailedCategory')}
                            </th>
                        </tr>
                    )}
                    {accessiblePlacesCountByDetailedCategory}
                </tbody>
            </table>
        );
    });
    return <div className="tr__form-section">{featureStats}</div>;
};

export default withTranslation(['transit', 'main'])(AccessibilityMapStatsComponent);
