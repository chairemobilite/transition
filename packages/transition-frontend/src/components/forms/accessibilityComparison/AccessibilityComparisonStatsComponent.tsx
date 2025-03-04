/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface AccessibilityComparisonStatsComponentProps {
    accessibilityPolygons: {
        result1: GeoJSON.FeatureCollection;
        result2: GeoJSON.FeatureCollection;
        intersection: GeoJSON.FeatureCollection;
    };
}

const AccessibilityComparisonStatsComponent: React.FunctionComponent<AccessibilityComparisonStatsComponentProps> = (
    props: AccessibilityComparisonStatsComponentProps
) => {
    const { t } = useTranslation(['transit', 'main']);

    const sortByDuration = (features: GeoJSON.Feature[]) => {
        features.sort((feat1, feat2) => {
            const duration1 = feat1.properties?.durationMinutes;
            console.log(duration1);
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

    const intersections = props.accessibilityPolygons.intersection.features;
    sortByDuration(intersections);

    const combinedFeatures: { result1: GeoJSON.Feature; result2: GeoJSON.Feature; intersection: GeoJSON.Feature }[] =
        [];

    for (let i = 0; i < features1.length; i++) {
        combinedFeatures.push({
            result1: features1[i],
            result2: features2[i],
            intersection: intersections[i]
        });
    }

    const featureStats = combinedFeatures.map((features) => {
        const properties1 = features.result1.properties;
        const properties2 = features.result2.properties;
        const intersection = features.intersection.properties;
        if (!properties1 || !properties2 || !intersection) return null;

        // TODO: POI import does not work correctly right now, so there is no point in having this section at the moment.
        // Uncomment and modify it to work with the three result categories in the future.
        // // fetch number of accessible places per category and detailed category:
        // const accessiblePlacesCountByCategory1: JSX.Element[] = [];
        // const accessiblePlacesCountByDetailedCategory1: JSX.Element[] = [];
        // let atLeastOneCategoryNotEmpty1 = false;
        // if (properties1.accessiblePlacesCountByCategory) {
        //     for (const category in properties1.accessiblePlacesCountByCategory) {
        //         if (properties1.accessiblePlacesCountByCategory[category] > 0) {
        //             atLeastOneCategoryNotEmpty1 = true;
        //         }
        //         accessiblePlacesCountByCategory1.push(
        //             <tr key={category}>
        //                 <th>{props.t(`main:places:categories:${category}`)}</th>
        //                 <td>{properties1.accessiblePlacesCountByCategory[category]}</td>
        //             </tr>
        //         );
        //     }
        // }
        // if (properties1.accessiblePlacesCountByDetailedCategory) {
        //     for (const detailedCategory in properties1.accessiblePlacesCountByDetailedCategory) {
        //         if (properties1.accessiblePlacesCountByDetailedCategory[detailedCategory] > 0) {
        //             accessiblePlacesCountByDetailedCategory1.push(
        //                 <tr key={detailedCategory}>
        //                     <th>{props.t(`main:places:detailedCategories:${detailedCategory}`)}</th>
        //                     <td>{properties1.accessiblePlacesCountByDetailedCategory[detailedCategory]}</td>
        //                 </tr>
        //             );
        //         }
        //     }
        // }

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
                    <td>{Math.round(properties1.areaSqKm * 100) / 100}</td>
                    <td>{Math.round(properties2.areaSqKm * 100) / 100}</td>
                    <td>{Math.round(intersection.areaSqKm * 100) / 100}</td>
                </tr>
                <tr>
                    <th>{t('transit:transitRouting:AccessibilityMapAreaSquarem')}</th>
                    <td>{Math.round(properties1.areaSqM)}</td>
                    <td>{Math.round(properties2.areaSqM)}</td>
                    <td>{Math.round(intersection.areaSqM)}</td>
                </tr>
                {/* TODO: Uncomment and adapt for three collumns when POIs are fixed. */}
                {/* {atLeastOneCategoryNotEmpty1 && (
                    <tr>
                        <th colSpan={2} className="_header">
                            {props.t('transit:transitRouting:NumberOfAccessiblePOIsByCategory')}
                        </th>
                    </tr>
                )}
                {atLeastOneCategoryNotEmpty1 && accessiblePlacesCountByCategory1}
                {accessiblePlacesCountByDetailedCategory1.length > 0 && (
                    <tr>
                        <th colSpan={2} className="_header">
                            {props.t('transit:transitRouting:NumberOfAccessiblePOIsByDetailedCategory')}
                        </th>
                    </tr>
                )}
                {accessiblePlacesCountByDetailedCategory1} */}
            </React.Fragment>
        );
    });

    return (
        <div className="tr__form-section">
            <table className="_statistics" style={{ borderSpacing: '10px' }}>
                <thead>
                    <tr>
                        <th></th>
                        <th style={{ color: 'rgb(255, 0, 0)' }}>
                            {t('transit:transitComparison:ScenarioN', { scenarioNumber: '1' })}
                        </th>
                        <th style={{ color: 'rgb(0, 255, 0)' }}>
                            {t('transit:transitComparison:ScenarioN', { scenarioNumber: '2' })}
                        </th>
                        <th style={{ color: 'rgb(47, 138, 243)' }}>
                            {t('transit:accessibilityComparison:Intersection')}
                        </th>
                    </tr>
                </thead>
                <tbody>{featureStats}</tbody>
            </table>
        </div>
    );
};

export default AccessibilityComparisonStatsComponent;
