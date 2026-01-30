/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect, useRef } from 'react';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons/faAngleRight';
import { faAngleLeft } from '@fortawesome/free-solid-svg-icons/faAngleLeft';
import { bbox as turfBbox } from '@turf/turf';

import TransitRoutingResults from './TransitRoutingResultComponent';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { RoutingResult } from 'chaire-lib-common/lib/services/routing/RoutingResult';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { SegmentToGeoJSONFromPaths } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';

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
    const [alternativeIndex, setAlternativeIndex] = useState(0);
    // Track if this is the first render to fit bounds only on initial display
    const isInitialRenderRef = useRef(true);

    const result = props.result;
    const error = result.getError();

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

    const alternativesCount = result.getAlternativesCount();
    const path = result.getPath(alternativeIndex);

    const onLeftButtonClick = () => {
        setAlternativeIndex(alternativeIndex > 0 ? alternativeIndex - 1 : alternativesCount - 1);
    };

    const onRightButtonClick = () => {
        setAlternativeIndex(alternativesCount > alternativeIndex + 1 ? alternativeIndex + 1 : 0);
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
                            {alternativeIndex + 1}/{alternativesCount}
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
                </div>
            </div>
            {path && (
                <TransitRoutingResults path={path} request={props.request} routingMode={result.getRoutingMode()} />
            )}
        </React.Fragment>
    );
};

export default RoutingResults;
