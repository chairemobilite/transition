/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { faAngleRight } from '@fortawesome/free-solid-svg-icons/faAngleRight';
import { faAngleLeft } from '@fortawesome/free-solid-svg-icons/faAngleLeft';

import ScenarioComparisonResults from './ScenarioComparisonResults';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { RoutingResult } from 'chaire-lib-common/lib/services/routing/RoutingResult';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import { SegmentToGeoJSONFromPaths } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { useTranslation } from 'react-i18next';
import { TrRoutingRoute } from 'chaire-lib-common/lib/services/transitRouting/types';

export interface AlternativesSelectProps {
    result1: RoutingResult;
    result2: RoutingResult;
    request: TransitRoutingAttributes;
    scenarioNames: {
        name1: string;
        name2: string;
    };
    hasAlternativeWalkPath: {
        result1: boolean;
        result2: boolean;
    };
}

export interface AlternativesSelectOneScenarioProps {
    result: RoutingResult;
    alternativeIndex: number;
    setAlternativeIndex: (arg: number) => void;
    useAlternateLayerAndColor: boolean;
}

const showCurrentAlternative = async (result, alternativeIndex, useAlternateLayer) => {
    const pathCollection = serviceLocator.collectionManager.get('paths');
    const segmentToGeojson = new SegmentToGeoJSONFromPaths(pathCollection);
    const options = { completeData: false, segmentToGeojson: segmentToGeojson.segmentToGeoJSONFromPaths };
    const pathGeojson = await result.getPathGeojson(alternativeIndex, options);
    (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
        layerName: 'routingPoints',
        data: result.originDestinationToGeojson()
    });
    if (useAlternateLayer) {
        serviceLocator.eventManager.emit('map.updateLayers', {
            routingPathsAlternate: pathGeojson,
            routingPathsStrokesAlternate: pathGeojson
        });
    } else {
        serviceLocator.eventManager.emit('map.updateLayers', {
            routingPaths: pathGeojson,
            routingPathsStrokes: pathGeojson
        });
    }
};

const AlternativesSelect: React.FunctionComponent<AlternativesSelectProps> = (props: AlternativesSelectProps) => {
    const { t } = useTranslation(['transit']);

    const [alternativeIndex1, setAlternativeIndex1] = useState(0);
    const [alternativeIndex2, setAlternativeIndex2] = useState(0);

    const result1 = props.result1;
    const result2 = props.result2;

    const error1 = result1.getError();
    const error2 = result2.getError();

    if (error1 && error2) {
        return (
            <FormErrors
                errors={[
                    t('transit:transitComparison:ScenarioError', { scenarioNumber: '1' }),
                    error1.export().localizedMessage,
                    t('transit:transitComparison:ScenarioError', { scenarioNumber: '2' }),
                    error2.export().localizedMessage
                ]}
            />
        );
    } else if (error1) {
        return (
            <FormErrors
                errors={[
                    t('transit:transitComparison:ScenarioError', { scenarioNumber: '1' }),
                    error1.export().localizedMessage
                ]}
            />
        );
    } else if (error2) {
        return (
            <FormErrors
                errors={[
                    t('transit:transitComparison:ScenarioError', { scenarioNumber: '2' }),
                    error2.export().localizedMessage
                ]}
            />
        );
    }

    const path1 = result1.getPath(alternativeIndex1) as TrRoutingRoute;
    const path2 = result2.getPath(alternativeIndex2) as TrRoutingRoute;

    return (
        <React.Fragment>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 3fr 1fr', columnGap: '10px' }}>
                <div>
                    <div>
                        {t('transit:transitComparison:ScenarioAlternatives', {
                            scenarioNumber: '1'
                        }) + ','}
                    </div>
                    {/* If the scenario's name takes 3 lines or more, it will truncate itself with an ellipsis. */}
                    <div className="tr__form-limit-to-two-lines">{props.scenarioNames.name1}</div>
                </div>
                <AlternativesSelectOneScenario
                    result={result1}
                    alternativeIndex={alternativeIndex1}
                    setAlternativeIndex={setAlternativeIndex1}
                    useAlternateLayerAndColor={false}
                />
                <div style={{ color: '#ff00ff' }}>
                    <div>
                        {t('transit:transitComparison:ScenarioAlternatives', {
                            scenarioNumber: '2'
                        }) + ','}
                    </div>
                    <div className="tr__form-limit-to-two-lines">{props.scenarioNames.name2}</div>
                </div>
                <AlternativesSelectOneScenario
                    result={result2}
                    alternativeIndex={alternativeIndex2}
                    setAlternativeIndex={setAlternativeIndex2}
                    useAlternateLayerAndColor={true}
                />
            </div>
            <br></br>
            {path1 && path2 && (
                <div>
                    <ScenarioComparisonResults
                        paths={{ path1, path2 }}
                        request={props.request}
                        hasAlternativeWalkPath={props.hasAlternativeWalkPath}
                    />
                </div>
            )}
        </React.Fragment>
    );
};

const AlternativesSelectOneScenario: React.FunctionComponent<AlternativesSelectOneScenarioProps> = (
    props: AlternativesSelectOneScenarioProps
) => {
    const alternativesCount = props.result.getAlternativesCount();

    const onLeftButtonClick = () => {
        props.setAlternativeIndex(props.alternativeIndex > 0 ? props.alternativeIndex - 1 : alternativesCount - 1);
    };

    const onRightButtonClick = () => {
        props.setAlternativeIndex(alternativesCount > props.alternativeIndex + 1 ? props.alternativeIndex + 1 : 0);
    };

    showCurrentAlternative(props.result, props.alternativeIndex, props.useAlternateLayerAndColor);

    return (
        <React.Fragment>
            <div className="tr__form-buttons-container">
                {alternativesCount > 1 && (
                    <Button
                        icon={faAngleLeft}
                        color="blue"
                        iconClass="_icon-alone"
                        label=""
                        onClick={() => onLeftButtonClick()}
                    />
                )}
                {alternativesCount > 0 && (
                    <span className="_strong" style={props.useAlternateLayerAndColor ? { color: '#ff00ff' } : {}}>
                        {props.alternativeIndex + 1}/{alternativesCount}
                    </span>
                )}
                {alternativesCount > 1 && (
                    <Button
                        icon={faAngleRight}
                        color="blue"
                        iconClass="_icon-alone"
                        label=""
                        onClick={() => onRightButtonClick()}
                    />
                )}
            </div>
        </React.Fragment>
    );
};

export default AlternativesSelect;
