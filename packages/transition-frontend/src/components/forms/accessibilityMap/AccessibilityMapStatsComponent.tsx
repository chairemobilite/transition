/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Collapsible from 'react-collapsible';
import { Tooltip } from 'react-tooltip';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';

export interface AccessibilityMapStatsComponentProps {
    accessibilityPolygons: GeoJSON.FeatureCollection;
}

const AccessibilityMapStatsComponent: React.FunctionComponent<AccessibilityMapStatsComponentProps> = (
    props: AccessibilityMapStatsComponentProps
) => {
    const { t, i18n } = useTranslation(['transit', 'main']);

    //We make the background color a very transparent white so that nested collapsibles can be distinguished with increasingly light colors.
    const collapsibleBackgroundColor = 'rgba(255, 255, 255, 0.05)';
    const textEmphasizedColor = 'rgb(216, 239, 253)';

    const features = props.accessibilityPolygons.features;

    const language = i18n.language;

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
        const accessiblePlacesCountByDetailedCategoryEmpty: JSX.Element[] = [];
        let categoryTotal = 0;
        if (properties.accessiblePlacesCountByCategory) {
            for (const category in properties.accessiblePlacesCountByCategory) {
                categoryTotal += Number(properties.accessiblePlacesCountByCategory[category]);
                accessiblePlacesCountByCategory.push(
                    <tr key={category}>
                        <th>{t(`main:places:categories:${category}`)}</th>
                        <td style={{ whiteSpace: 'nowrap', width: '0.1%' }}>
                            {properties.accessiblePlacesCountByCategory[category]}
                        </td>
                    </tr>
                );
            }
        }
        if (properties.accessiblePlacesCountByDetailedCategory) {
            for (const detailedCategory in properties.accessiblePlacesCountByDetailedCategory) {
                if (properties.accessiblePlacesCountByDetailedCategory[detailedCategory] > 0) {
                    accessiblePlacesCountByDetailedCategory.push(
                        <tr key={detailedCategory}>
                            <th>{t(`main:places:detailedCategories:${detailedCategory}`)}</th>
                            <td style={{ whiteSpace: 'nowrap', width: '0.1%' }}>
                                {properties.accessiblePlacesCountByDetailedCategory[detailedCategory]}
                            </td>
                        </tr>
                    );
                } else if (properties.accessiblePlacesCountByDetailedCategory[detailedCategory] === 0) {
                    accessiblePlacesCountByDetailedCategoryEmpty.push(
                        <tr key={detailedCategory}>
                            <th>{t(`main:places:detailedCategories:${detailedCategory}`)}</th>
                            <td style={{ whiteSpace: 'nowrap', width: '0.1%' }}>
                                {properties.accessiblePlacesCountByDetailedCategory[detailedCategory]}
                            </td>
                        </tr>
                    );
                }
            }
        }

        const [showEmptyDetailedCategories, setShowEmptyDetailedCategories] = useState(false);

        const detailedCategoryCollapsible = (
            <div style={{ margin: '1em 1em 0em 1em', backgroundColor: collapsibleBackgroundColor }}>
                <Collapsible
                    trigger={
                        <b style={{ color: textEmphasizedColor }}>
                            {t('transit:transitRouting:SeeDetailedCategories')}
                        </b>
                    }
                    triggerStyle={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
                    open={false}
                    transitionTime={100}
                >
                    {accessiblePlacesCountByDetailedCategoryEmpty.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <InputCheckboxBoolean
                                id={`showEmptyDetailedCategoriesCheckbox${Math.round(properties.durationMinutes)}`}
                                label={t('transit:transitRouting:ShowEmptyDetailedCategories')}
                                isChecked={showEmptyDetailedCategories}
                                onValueChange={(e) => setShowEmptyDetailedCategories(e.target.value)}
                            />
                        </div>
                    )}
                    {accessiblePlacesCountByDetailedCategory}
                    {showEmptyDetailedCategories && accessiblePlacesCountByDetailedCategoryEmpty}
                </Collapsible>
            </div>
        );

        return (
            <table className="_statistics" key={properties.durationMinutes}>
                <tbody>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {t('transit:transitRouting:AccessibilityMapAreaTitle', {
                                n: Math.round(properties.durationMinutes)
                            })}
                        </th>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:AccessibilityMapAreaSquareKm')}</th>
                        <td>{(Math.round(properties.areaSqKm * 100) / 100).toLocaleString(language)}</td>
                    </tr>
                    {typeof properties.population === 'number' && (
                        <tr>
                            <th>{t('transit:transitRouting:AccessibilityMapPopulation')}</th>
                            <td>{properties.population.toLocaleString(language)}</td>
                        </tr>
                    )}
                    {categoryTotal > 0 && (
                        <React.Fragment>
                            <tr>
                                <th colSpan={2} className="_header" data-tooltip-id="accessible-POI-header">
                                    {t('transit:transitRouting:NumberOfAccessiblePOIsInNMinutesByCategory', {
                                        n: Math.round(properties.durationMinutes)
                                    })}
                                </th>
                            </tr>
                            <tr>
                                <th colSpan={2}>
                                    <div style={{ margin: 0 }}>
                                        <Collapsible
                                            trigger={
                                                <div>
                                                    {t('transit:transitRouting:TotalPOIs')}&nbsp;
                                                    <span style={{ color: textEmphasizedColor }}>{categoryTotal}</span>
                                                </div>
                                            }
                                            triggerStyle={{ backgroundColor: collapsibleBackgroundColor }}
                                            open={false}
                                            transitionTime={100}
                                        >
                                            <div style={{ backgroundColor: collapsibleBackgroundColor }}>
                                                <div>{accessiblePlacesCountByCategory}</div>
                                                {accessiblePlacesCountByDetailedCategory.length > 0 &&
                                                    detailedCategoryCollapsible}
                                                <br></br>
                                            </div>
                                        </Collapsible>
                                    </div>
                                </th>
                            </tr>
                        </React.Fragment>
                    )}
                </tbody>
                <Tooltip id="accessible-POI-header" opacity={1} style={{ maxWidth: '90%', zIndex: 100 }}>
                    <span>{t('transit:transitRouting:AccessiblePOIsPopup')}</span>
                </Tooltip>
            </table>
        );
    });
    return <div className="tr__form-section">{featureStats}</div>;
};

export default AccessibilityMapStatsComponent;
