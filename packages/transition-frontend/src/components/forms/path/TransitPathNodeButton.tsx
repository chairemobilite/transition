/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import DistanceUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/DistanceUnitFormatter';
import DurationUnitFormatter from 'chaire-lib-frontend/lib/components/pageParts/DurationUnitFormatter';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Path from 'transition-common/lib/services/path/Path';
import Node from 'transition-common/lib/services/nodes/Node';

interface PathButtonProps extends WithTranslation {
    path: Path;
    node: Node;
    nodeIndex: number;
    nodeGeographyError: boolean;
}

const TransitPathButton: React.FunctionComponent<PathButtonProps> = (props: PathButtonProps) => {
    const node = props.node;
    const path = props.path;
    const isFrozen = path.isFrozen();
    const countNodes = path.countNodes();
    const nodeIndex = props.nodeIndex;
    const nodeId = node.getId();
    const dwellTimeSeconds = path.attributes.data.dwellTimeSeconds || [];
    const cumulativeTimeSecondsAfter =
        nodeIndex < countNodes ? path.getCumulativeTimeForNodeIndex(nodeIndex + 1) : undefined;
    const cumulativeDistanceMeters =
        nodeIndex < countNodes ? path.getCumulativeDistanceForNodeIndex(nodeIndex + 1) : undefined;
    const nodeTitle = `${node.toString(false)} ${
        dwellTimeSeconds[nodeIndex] ? `(${dwellTimeSeconds[nodeIndex]}s)` : ''
    }`;
    const segments = path.attributes.data.segments || [];
    const nodeGeographyError = props.nodeGeographyError;

    const onSelectPathNode = function (e: React.MouseEvent) {
        e.stopPropagation();
        serviceLocator.eventManager.emit('map.setCenter', node.attributes.geography.coordinates);
    };

    const onHoverPathNode = function (e: React.MouseEvent) {
        e.stopPropagation();
        serviceLocator.eventManager.emit('path.hoverNode', node, nodeTitle);
    };

    const onUnhoverPathNode = function (e: React.MouseEvent) {
        e.stopPropagation();
        serviceLocator.eventManager.emit('path.unhoverNode', nodeId);
    };

    const removeNodeFromPath = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await path.removeNode(nodeIndex);
            if (!response.path) {
                console.error('error removing node promise'); // todo: better error handling
            } else {
                serviceLocator.selectedObjectsManager.update('path', response.path);
                serviceLocator.eventManager.emit('selected.updateLayers.path');
            }
        } catch (error) {
            console.error(error); // todo: better error handling
        }
    };

    return (
        <React.Fragment key={nodeId}>
            <li
                className={'_path-node-list'}
                onClick={onSelectPathNode}
                onMouseOver={onHoverPathNode}
                onMouseOut={onUnhoverPathNode}
                key={`node${nodeIndex}`}
            >
                <span className="_path-node-circle-container">
                    <span
                        className="_path-node-circle 1.9rem _strong"
                        style={{
                            backgroundColor: node.getAttributes().color,
                            textShadow: '0rem 0rem 0.2rem rgba(0,0,0,1.0),0rem 0rem 0.2rem rgba(0,0,0,1.0)', // double shadow for clear outline
                            paddingTop: '0.4rem',
                            color: 'rgba(255,255,255,1.0)',
                            borderColor: nodeGeographyError ? 'rgba(255,0,0,1.0)' : undefined
                        }}
                    >
                        {nodeIndex + 1}
                    </span>
                </span>
                <span className="_path-node-label-container _small" title={nodeTitle}>
                    <span className="_path-node-label">
                        {node.toString(false) as string}{' '}
                        <span style={{ whiteSpace: 'nowrap' }}>
                            <img
                                className="_icon _o100"
                                style={{ marginBottom: '-0.25rem', marginRight: 0 }}
                                src={'/dist/images/icons/interface/sandglass_white.svg'}
                                alt={props.t('transit:transitNode:DwellTime')}
                            />
                            {dwellTimeSeconds[nodeIndex]}s
                        </span>
                    </span>

                    <br />
                    {!isFrozen && (
                        <span className="_path-node-icons-container _flush-right" onClick={removeNodeFromPath}>
                            <img
                                className="_icon"
                                src={'/dist/images/icons/interface/delete_white.svg'}
                                alt={props.t('main:Delete')}
                            />
                        </span>
                    )}
                </span>
            </li>

            {nodeIndex < countNodes - 1 && (
                <li className={'_path-segment-list'} key={`segment${nodeIndex}`}>
                    <span className="_path-segment-label-container">
                        <span className="_path-segment-label">
                            {segments[nodeIndex]?.travelTimeSeconds ? (
                                <DurationUnitFormatter
                                    value={segments[nodeIndex].travelTimeSeconds!}
                                    sourceUnit="s"
                                    destinationUnit="s"
                                />
                            ) : (
                                '? s'
                            )}
                        </span>
                        <span className="_path-segment-label">
                            {segments[nodeIndex]?.distanceMeters ? (
                                <DistanceUnitFormatter value={segments[nodeIndex].distanceMeters!} sourceUnit="m" />
                            ) : (
                                '?'
                            )}
                        </span>
                        {cumulativeTimeSecondsAfter && cumulativeDistanceMeters && <br />}
                        {cumulativeTimeSecondsAfter && cumulativeDistanceMeters && (
                            <span className="_path-segment-label" title={props.t('main:Cumulative')}>
                                <img
                                    className="_icon _o100"
                                    style={{ marginBottom: '-0.25rem', marginRight: 0 }}
                                    src={'/dist/images/icons/interface/arrow_cumulative_white.svg'}
                                    alt={props.t('main:Cumulative')}
                                />
                            </span>
                        )}
                        {cumulativeTimeSecondsAfter && (
                            <span className="_path-segment-label" title={props.t('main:Cumulative')}>
                                <DurationUnitFormatter value={cumulativeTimeSecondsAfter} sourceUnit="s" />
                            </span>
                        )}
                        &#8213; &nbsp;
                        {cumulativeDistanceMeters && (
                            <span className="_path-segment-label" title={props.t('main:Cumulative')}>
                                <DistanceUnitFormatter value={cumulativeDistanceMeters} sourceUnit="m" />
                            </span>
                        )}
                    </span>
                </li>
            )}
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(TransitPathButton);
