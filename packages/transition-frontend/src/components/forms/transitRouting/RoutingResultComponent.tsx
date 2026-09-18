/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect, useRef } from 'react';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons/faAngleRight';
import { faAngleLeft } from '@fortawesome/free-solid-svg-icons/faAngleLeft';
import { faArrowDownShortWide } from '@fortawesome/free-solid-svg-icons/faArrowDownShortWide';
import { bbox as turfBbox } from '@turf/turf';

import TransitRoutingResults from './TransitRoutingResultComponent';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { RoutingResult } from 'chaire-lib-common/lib/services/routing/RoutingResult';
import { buildSortedIndices, SortAlternativesBy } from 'chaire-lib-common/lib/services/routing/RoutingResultSorter';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { SegmentToGeoJSONFromPaths } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { useTranslation } from 'react-i18next';

export interface RoutingResultStatus {
    routingResult: RoutingResult;
    alternativeIndex: number;
    activeStepIndex: number | null;
}

export interface TransitRoutingResultsProps {
    result: RoutingResult;
    request: TransitRoutingAttributes;
}

const showCurrentAlternative = async (
    result: RoutingResult,
    alternativeIndex: number,
    fitBounds: boolean = false
): Promise<void> => {
    const pathCollection = serviceLocator.collectionManager.get('paths');
    const segmentToGeojson = new SegmentToGeoJSONFromPaths(pathCollection);
    const options = { completeData: false, segmentToGeojson: segmentToGeojson.segmentToGeoJSONFromPaths };
    const pathGeojson = await result.getPathGeojson(alternativeIndex, options);
    (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
        layerName: 'routingPoints',
        data: result.originDestinationToGeojson()
    });
    serviceLocator.eventManager.emit('map.updateLayers', {
        routingPaths: pathGeojson,
        routingPathsStrokes: pathGeojson
    });

    // Fit map bounds to the routing path
    if (fitBounds && pathGeojson && pathGeojson.features && pathGeojson.features.length > 0) {
        const bounds = turfBbox(pathGeojson);
        // bounds is [minX, minY, maxX, maxY] = [west, south, east, north]
        serviceLocator.eventManager.emit('map.fitBounds', [
            [bounds[0], bounds[1]], // southwest
            [bounds[2], bounds[3]] // northeast
        ]);
    }
};

const RoutingResults: React.FunctionComponent<TransitRoutingResultsProps> = (props: TransitRoutingResultsProps) => {
    const { t } = useTranslation('transit');
    const [displayIndex, setDisplayIndex] = useState(0);
    // FIXME: Store in user preferences
    const [sortedBy, setSortedBy] = useState<SortAlternativesBy>('none');
    // Track if this is the first render to fit bounds only on initial display
    const isInitialRenderRef = useRef(true);

    const result = props.result;
    const error = result.getError();
    const alternativesCount = result.getAlternativesCount();

    // Compute alternative indices in display order
    const sortedIndices = React.useMemo(() => buildSortedIndices(result, sortedBy), [result, sortedBy]);

    // Map display position to the actual alternative index
    const alternativeIndex = sortedIndices[displayIndex];

    // Use effect to show the current alternative and fit bounds on initial render
    // Must be placed before any early returns to ensure hooks are called in the same order
    useEffect(() => {
        if (error) {
            return; // Skip showing alternative if there's an error
        }
        const shouldFitBounds = isInitialRenderRef.current;
        showCurrentAlternative(result, alternativeIndex, shouldFitBounds);
        isInitialRenderRef.current = false;
    }, [result, alternativeIndex, error]);

    if (error) {
        return <FormErrors errors={[error.export().localizedMessage]} />;
    }

    const path = result.getPath(alternativeIndex);

    const onLeftButtonClick = () => {
        setDisplayIndex(displayIndex > 0 ? displayIndex - 1 : alternativesCount - 1);
    };

    const onRightButtonClick = () => {
        setDisplayIndex(alternativesCount > displayIndex + 1 ? displayIndex + 1 : 0);
    };

    const onSortButtonClick = () => {
        setDisplayIndex(0);
        setSortedBy(sortedBy === 'none' ? 'travelTime' : 'none');
    };

    return (
        <React.Fragment>
            <div>
                <div
                    className="tr__form-buttons-container"
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowLeft') {
                            onLeftButtonClick();
                        } else if (e.key === 'ArrowRight') {
                            onRightButtonClick();
                        }
                    }}
                >
                    {alternativesCount > 1 && (
                        <Button
                            icon={faAngleLeft}
                            color="blue"
                            iconClass="_icon-alone"
                            label=""
                            onClick={onLeftButtonClick}
                        />
                    )}
                    {alternativesCount > 0 && (
                        <span className="_strong">
                            {displayIndex + 1}/{alternativesCount}
                        </span>
                    )}
                    {alternativesCount > 1 && (
                        <Button
                            icon={faAngleRight}
                            color="blue"
                            iconClass="_icon-alone"
                            label=""
                            onClick={onRightButtonClick}
                        />
                    )}
                    {alternativesCount > 1 && (
                        <Button
                            icon={faArrowDownShortWide}
                            color={sortedBy === 'travelTime' ? 'green' : 'grey'}
                            iconClass="_icon-alone"
                            label=""
                            onClick={onSortButtonClick}
                            title={t('transit:transitPath.sort.TravelTime')}
                        />
                    )}
                </div>
            </div>
            {path && (
                <TransitRoutingResults path={path} request={props.request} routingMode={result.getRoutingMode()} />
            )}
        </React.Fragment>
    );
};

export default RoutingResults;
