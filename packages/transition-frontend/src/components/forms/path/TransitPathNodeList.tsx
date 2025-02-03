/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { bbox as turfBbox } from '@turf/turf';

import Path from 'transition-common/lib/services/path/Path';
import TransitPathNodeButton from './TransitPathNodeButton';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import TransitPathHelp from '../../path/TransitPathHelp';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';

interface PathListProps extends WithTranslation {
    selectedPath: Path;
}

const TransitPathNodeList: React.FunctionComponent<PathListProps> = (props: PathListProps) => {
    React.useEffect(() => {
        if (props.selectedPath) {
            const geography = props.selectedPath.attributes.geography;
            if (geography) {
                setTimeout(() => {
                    const bbox = turfBbox(geography);
                    serviceLocator.eventManager.emit('map.fitBounds', [
                        [bbox[0], bbox[1]],
                        [bbox[2], bbox[3]]
                    ]); // getBoundsForCoordinates(geography.coordinates));
                }, 300);
            }
        }
    }, [props.selectedPath]);

    const nodesGeojsonFeatures = props.selectedPath.nodesGeojsons();

    if (!nodesGeojsonFeatures || nodesGeojsonFeatures.length === 0) {
        return (
            <div
                className="tr__list-transit-paths-nodes-list-container"
                style={{ display: 'flex', justifyContent: 'left' }}
            >
                <TransitPathHelp />
                <p className="_orange">{props.t('transit:transitPath:ClickOnTransitNodeToStart')}</p>
            </div>
        );
    }

    const nodeCollection = new NodeCollection([], {}, undefined);
    const nodesButtons = nodesGeojsonFeatures.map((feature, index) => {
        const nodeFeature = feature as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>;
        return (
            <TransitPathNodeButton
                key={`node ${index}`}
                path={props.selectedPath}
                nodeIndex={index}
                nodeGeographyError={
                    typeof props.selectedPath?.attributes.data?.geographyErrors?.nodes?.find(
                        (nodeError) => nodeError?.properties?.id === nodeFeature.properties.id
                    ) === 'object'
                }
                node={nodeCollection.newObject(nodeFeature)}
            />
        );
    });

    // get layover data:
    const layoverTimeSeconds: number | undefined = props.selectedPath.getAttributes()?.data?.layoverTimeSeconds as
        | number
        | undefined;

    return (
        <div
            className="tr__list-transit-paths-nodes-list-container"
            style={{ display: 'flex', justifyContent: 'left' }}
        >
            <TransitPathHelp />
            <ul className="tr__list-transit-paths-nodes _path-node-list-container">
                {nodesButtons}
                {/* Add layover at the end: */}
                {layoverTimeSeconds && (
                    <li className={'_path-segment-list'} key={'segmentLayover'}>
                        <span className="_path-segment-label-container">
                            <span className="_path-segment-label">
                                {props.t('transit:transitPath:LayoverTime')}: {layoverTimeSeconds}s (
                                {Math.ceil(layoverTimeSeconds) / 60} min)
                            </span>
                        </span>
                    </li>
                )}
            </ul>
        </div>
    );
};

export default withTranslation('transit')(TransitPathNodeList);
