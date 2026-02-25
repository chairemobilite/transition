/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useEffect } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Path from 'transition-common/lib/services/path/Path';
import TransitPathNodeButton from './TransitPathNodeButton';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import ToggleableHelp from 'chaire-lib-frontend/lib/components/pageParts/ToggleableHelp';

interface PathListProps extends WithTranslation {
    selectedPath: Path;
}

const TransitPathNodeList: React.FunctionComponent<PathListProps> = (props: PathListProps) => {
    const pathId = props.selectedPath.getId();

    // This panel shrinks the map container when it mounts. The
    // fitBoundsIfNotVisible call must happen here (not in the path
    // selection handler) so that the panel is already in the DOM.
    // The event handler calls map.resize() to force MapLibre to
    // measure the new container size before computing visibility.
    //
    // Dep array intentionally uses only pathId: geography is an
    // attribute of the path and doesn't change independently, so
    // re-running on path ID change is sufficient. Including the
    // Path object or its geography would cause spurious re-runs
    // because the object reference can change on every render.
    useEffect(() => {
        const geography = props.selectedPath.attributes.geography;
        if (geography && geography.coordinates && geography.coordinates.length >= 2) {
            serviceLocator.eventManager.emit('map.fitBoundsIfNotVisible', geography);
        }
    }, [pathId]);

    const nodesGeojsonFeatures = props.selectedPath.nodesGeojsons();

    if (!nodesGeojsonFeatures || nodesGeojsonFeatures.length === 0) {
        return (
            <div
                className="tr__list-transit-paths-nodes-list-container"
                style={{ display: 'flex', justifyContent: 'left' }}
            >
                <ToggleableHelp namespace="transit" section="transitPath" />
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
    const layoverTimeSeconds: number | undefined = props.selectedPath.attributes?.data?.layoverTimeSeconds as
        | number
        | undefined;

    return (
        <div
            className="tr__list-transit-paths-nodes-list-container"
            style={{ display: 'flex', justifyContent: 'left' }}
        >
            <ToggleableHelp namespace="transit" section="transitPath" />
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
