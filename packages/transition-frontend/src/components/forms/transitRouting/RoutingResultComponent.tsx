/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons/faAngleRight';
import { faAngleLeft } from '@fortawesome/free-solid-svg-icons/faAngleLeft';

import TransitRoutingResults from './TransitRoutingResultComponent';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    RouteCalculatorResult,
    UnimodalRouteCalculationResult
} from 'transition-common/lib/services/transitRouting/RouteCalculatorResult';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
export interface RoutingResultStatus {
    routingResult: UnimodalRouteCalculationResult | TransitRoutingResult;
    alternativeIndex: number;
    activeStepIndex: number | null;
}

export interface TransitRoutingResultsProps extends WithTranslation {
    result: UnimodalRouteCalculationResult | TransitRoutingResult;
    request: TransitRoutingAttributes;
}

const showCurrentAlternative = async (result, alternativeIndex) => {
    const pathGeojson = await result.getPathGeojson(alternativeIndex, {});
    serviceLocator.eventManager.emit('map.updateLayers', {
        routingPoints: result.originDestinationToGeojson(),
        routingPaths: pathGeojson,
        routingPathsStrokes: pathGeojson
    });
};

const resultIsTransitRoutingResult = (
    result: UnimodalRouteCalculationResult | TransitRoutingResult
): result is TransitRoutingResult => {
    return typeof (result as any).getWalkOnlyRoute === 'function';
};

const RoutingResults: React.FunctionComponent<TransitRoutingResultsProps> = (props: TransitRoutingResultsProps) => {
    const [alternativeIndex, setAlternativeIndex] = useState(0);

    const result = props.result;

    const error = result.getError();
    if (error) {
        return <FormErrors errors={[error.export().localizedMessage]} />;
    }

    const alternativesCount = result.getAlternativesCount();
    const path = result.getPath(alternativeIndex);
    // TODO There should be no need of a separate walkOnlyRoute once all results share a same interface
    const walkOnlyRoute = resultIsTransitRoutingResult(result) ? result.getWalkOnlyRoute() : undefined;

    // TODO This may be racy (it already was) if the user switches alternative rapidly. Make it cancellable.
    showCurrentAlternative(result, alternativeIndex);

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
            {(path || walkOnlyRoute) && (
                <TransitRoutingResults
                    path={path}
                    walkOnly={walkOnlyRoute}
                    request={props.request}
                    routingMode={result.getRoutingMode()}
                />
            )}
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(RoutingResults);
