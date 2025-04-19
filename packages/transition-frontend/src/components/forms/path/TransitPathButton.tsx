/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import MathJax from 'react-mathjax';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Path, { PathAttributesData } from 'transition-common/lib/services/path/Path';
import Line from 'transition-common/lib/services/line/Line';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

interface PathButtonProps extends WithTranslation {
    line: Line;
    path: Path;
    selectedPath?: Path;
    selectedSchedule?: boolean;
}

const TransitPathButton: React.FunctionComponent<PathButtonProps> = (props: PathButtonProps) => {
    const pathIsSelected = (props.selectedPath && props.selectedPath.getId() === props.path.getId()) || false;

    const onSelect: React.MouseEventHandler = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (
            !props.selectedSchedule &&
            (!props.selectedPath ||
                (props.selectedPath &&
                    props.selectedPath.getId() !== props.path.getId() &&
                    !props.selectedPath.hasChanged()))
        ) {
            serviceLocator.socketEventManager.emit('transitPath.read', props.path.getId(), null, (response) => {
                const path = new Path({ ...response.path }, false, serviceLocator.collectionManager);
                path.startEditing();
                serviceLocator.eventManager.emit('map.disableBoxZoom');
                serviceLocator.selectedObjectsManager.setSelection('path', [path]); // auto deselect
                serviceLocator.eventManager.emit('selected.updateLayers.path');
            });
        }
    };

    const onDelete: React.MouseEventHandler = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!props.path.isNew()) {
            serviceLocator.eventManager.emit('progress', { name: 'DeletingPath', progress: 0.0 });
            await props.path.delete(serviceLocator.socketEventManager);
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'transitPaths',
                data: serviceLocator.collectionManager.get('paths').toGeojsonSimplified()
            });
            serviceLocator.eventManager.emit('progress', { name: 'DeletingPath', progress: 1.0 });
        }

        if (pathIsSelected) {
            serviceLocator.selectedObjectsManager.deselect('path');
        }
        serviceLocator.collectionManager.refresh('paths');
    };

    const onCreateReversePath: React.MouseEventHandler = async (e: React.MouseEvent) => {
        e.stopPropagation();

        // TODO Move reverse path creation somewhere else
        serviceLocator.socketEventManager.emit('transitPath.read', props.path.getId(), null, async (response) => {
            try {
                const pathToReverse = new Path({ ...response.path }, false, serviceLocator.collectionManager);
                const direction = pathToReverse.getAttributes().direction;
                const newAttributes = pathToReverse.getClonedAttributes();
                delete newAttributes.name;
                const newData = newAttributes.data as Partial<PathAttributesData>;
                //delete newAttributes.data;
                delete newData.dwellTimeSeconds;
                delete newData.operatingSpeedMetersPerSecond;
                delete newData.operatingSpeedWithLayoverMetersPerSecond;
                delete newData.operatingTimeWithLayoverTimeSeconds;
                delete newData.operatingTimeWithoutLayoverTimeSeconds;
                delete newData.returnBackGeography;
                delete newData.totalDistanceMeters;
                delete newData.totalDwellTimeSeconds;
                delete newData.totalTravelTimeWithReturnBackSeconds;
                delete newData.travelTimeWithoutDwellTimesSeconds;
                delete newData.segments;
                delete newData.averageSpeedWithoutDwellTimesMetersPerSecond;
                delete newData.variables;
                delete newData.nodeTypes;
                newAttributes.data = newData as any;

                newAttributes.geography = undefined;
                newAttributes.segments = [];
                newAttributes.nodes = (newAttributes.nodes || []).reverse();
                newAttributes.stops = (newAttributes.stops || []).reverse();
                newAttributes.direction =
                    direction === 'outbound' ? 'inbound' : direction === 'inbound' ? 'outbound' : 'other';
                const reversedPath = new Path(newAttributes, true, serviceLocator.collectionManager);

                const waypoints = newData.waypoints || [];
                const waypointTypes = newData.waypointTypes || [];
                if (reversedPath.getData('routingEngine') === 'manual') {
                    // reverse waypoints if any:
                    if (waypoints.length >= reversedPath.attributes.nodes.length) {
                        // remove waypoints after last node
                        waypoints.pop();
                        waypointTypes.pop();
                    }
                    const reversedWaypoints: [number, number][][] = [];
                    const reversedWaypointTypes: string[][] = [];
                    waypoints.forEach((waypointsByNodeIndex, waypointIndex) => {
                        let waypointTypesByNodeIndex = waypointTypes[waypointIndex];
                        if (!waypointsByNodeIndex) {
                            waypointsByNodeIndex = [];
                        }
                        if (!waypointTypesByNodeIndex) {
                            waypointTypesByNodeIndex = [];
                        }
                        reversedWaypoints.push(waypointsByNodeIndex.reverse());
                        reversedWaypointTypes.push(waypointTypesByNodeIndex.reverse());
                    });
                    reversedPath.setData('waypoints', reversedWaypoints.reverse());
                    reversedPath.setData('waypointTypes', reversedWaypointTypes.reverse());
                } else {
                    reversedPath.setData('waypoints', []);
                    reversedPath.setData('waypointTypes', []);
                }

                const geographyResponse = await reversedPath.updateGeography();
                if (geographyResponse.path) {
                    await reversedPath.save(serviceLocator.socketEventManager);
                    serviceLocator.collectionManager.refresh('paths');
                    props.line.refreshPaths();
                    (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>(
                        'map.updateLayer',
                        {
                            layerName: 'transitPaths',
                            data: serviceLocator.collectionManager.get('paths').toGeojsonSimplified()
                        }
                    );
                    serviceLocator.selectedObjectsManager.setSelection('line', [props.line]);
                    serviceLocator.collectionManager.refresh('lines');
                }
            } catch (error) {
                console.error('Error reversing path', error);
            }
        });
    };

    const onDuplicate: React.MouseEventHandler = async (e: React.MouseEvent) => {
        e.stopPropagation();

        serviceLocator.socketEventManager.emit('transitPath.read', props.path.getId(), null, async (response) => {
            try {
                const pathToDuplicate = new Path({ ...response.path }, false, serviceLocator.collectionManager);
                const newAttributes = pathToDuplicate.getClonedAttributes(true);
                if (newAttributes.name) {
                    newAttributes.name = `${newAttributes.name} (${props.t('main:copy')})`;
                }
                const duplicatePath = new Path(newAttributes, true, serviceLocator.collectionManager);
                await duplicatePath.save(serviceLocator.socketEventManager);
                serviceLocator.collectionManager.refresh('paths');
                props.line.refreshPaths();
                (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                    layerName: 'transitPaths',
                    data: serviceLocator.collectionManager.get('paths').toGeojsonSimplified()
                });
                serviceLocator.selectedObjectsManager.setSelection('line', [props.line]);
                serviceLocator.collectionManager.refresh('lines');
            } catch (error) {
                console.error(error); // todo: better error handling
            }
        });
    };

    const stopClick: React.MouseEventHandler = React.useCallback((e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
    }, []);

    const isFrozen = props.path.isFrozen();
    const halfCycleTimeSeconds = props.path.getAttributes().data.operatingTimeWithLayoverTimeSeconds;
    const halfCycleTimeMinutes = halfCycleTimeSeconds ? halfCycleTimeSeconds / 60 : undefined;

    return (
        <Button
            key={props.path.getId()}
            isSelected={pathIsSelected}
            flushActionButtons={false}
            onSelect={!props.selectedSchedule ? { handler: onSelect } : undefined}
            onDuplicate={
                !props.selectedSchedule
                    ? { handler: onDuplicate, altText: props.t('transit:transitPath:DuplicatePath') }
                    : undefined
            }
            onDelete={
                !isFrozen && !pathIsSelected && !props.selectedSchedule
                    ? {
                        handler: onDelete,
                        message: props.t('transit:transitPath:ConfirmDelete'),
                        altText: props.t('transit:transitPath:Delete')
                    }
                    : undefined
            }
        >
            <ButtonCell alignment="left">
                {props.t(`transit:transitPath:directions:${props.path.attributes.direction}`)}
            </ButtonCell>
            {isFrozen && (
                <ButtonCell alignment="left">
                    <img
                        className="_icon-alone"
                        src={'/dist/images/icons/interface/lock_white.svg'}
                        alt={props.t('main:Locked')}
                    />
                </ButtonCell>
            )}
            <ButtonCell alignment="left">
                {props.path.attributes.name ? props.path.attributes.name : props.path.getId().slice(0, 5)}
            </ButtonCell>
            <ButtonCell alignment="flush">
                {props.path.countNodes() > 1
                    ? props.t('transit:transitPath:nNodes', { n: props.path.countNodes() })
                    : props.t('transit:transitPath:nNode', { n: props.path.countNodes() })}
            </ButtonCell>
            {halfCycleTimeMinutes && (
                <ButtonCell alignment="right">
                    <div onClick={stopClick}>
                        <MathJax.Provider>
                            <MathJax.Node inline formula={'{T_c}_p'} data-tooltip-id="half-cycle-time-tooltip" />
                        </MathJax.Provider>
                    </div>
                    &nbsp;{Math.round(halfCycleTimeMinutes * 100) / 100}&nbsp;min
                </ButtonCell>
            )}
            {!props.selectedSchedule && (
                <ButtonCell
                    alignment={'right'}
                    onClick={onCreateReversePath}
                    title={props.t('transit:transitPath:CreateReversedPath')}
                >
                    <img
                        className="_icon-alone"
                        src={'/dist/images/icons/interface/reverse_white.svg'}
                        alt={props.t('transit:transitPath:CreateReversedPath')}
                    />
                </ButtonCell>
            )}
        </Button>
    );
};

export default withTranslation(['transit', 'main', 'notifications'])(TransitPathButton);
