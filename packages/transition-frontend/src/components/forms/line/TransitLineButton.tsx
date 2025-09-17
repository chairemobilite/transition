/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from 'transition-common/lib/services/line/Line';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';
import { duplicateLine } from 'transition-common/lib/services/line/LineDuplicator';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

interface LineButtonProps extends WithTranslation {
    line: Line;
    selectedLine?: Line;
    lineIsHidden: boolean;
    onObjectSelected?: (objectId: string) => void;
}

const TransitLineButton: React.FunctionComponent<LineButtonProps> = (props: LineButtonProps) => {
    const [lineIsHidden, setLineIsHidden] = React.useState(props.lineIsHidden);
    const lineIsSelected = (props.selectedLine && props.selectedLine.getId() === props.line.getId()) || false;

    const onSelect: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        await props.line.refreshSchedules(serviceLocator.socketEventManager);
        props.line.startEditing();
        if (props.onObjectSelected) {
            props.onObjectSelected(props.line.getId());
        }
        serviceLocator.selectedObjectsManager.setSelection('line', [props.line]);
    };

    const onDelete: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        const lineHasPaths = props.line.hasPaths();

        serviceLocator.eventManager.emit('progress', { name: 'DeletingLine', progress: 0.0 });
        await props.line.delete(serviceLocator.socketEventManager);
        if (lineIsSelected) {
            serviceLocator.selectedObjectsManager.deselect('line');
        }

        if (lineHasPaths) {
            // reload paths
            await serviceLocator.collectionManager.get('paths').loadFromServer(serviceLocator.socketEventManager);
            serviceLocator.collectionManager.refresh('paths');
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'transitPaths',
                data: serviceLocator.collectionManager.get('paths').toGeojsonSimplified()
            });
        }
        serviceLocator.eventManager.emit('progress', { name: 'DeletingLine', progress: 1.0 });
        serviceLocator.collectionManager.refresh('lines');
    };

    const onDuplicate: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        serviceLocator.eventManager.emit('progress', { name: 'SavingLine', progress: 0.0 });
        await duplicateLine(props.line, {
            socket: serviceLocator.socketEventManager,
            duplicateSchedules: true,
            duplicateServices: true,
            newLongname: `${props.line.get('longname')} (${props.t('main:Copy')})`,
            newServiceSuffix: props.t('main:Copy')
        });

        serviceLocator.collectionManager.refresh('paths');
        serviceLocator.collectionManager.refresh('lines');
        serviceLocator.collectionManager.refresh('services');
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitPaths',
            data: serviceLocator.collectionManager.get('paths').toGeojsonSimplified()
        });
        serviceLocator.eventManager.emit('progress', { name: 'SavingLine', progress: 1.0 });
    };

    const showOnMap = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (serviceLocator.keyboardManager.keyIsPressed('alt')) {
            serviceLocator.pathLayerManager.showAllLinesForAgency(props.line.get('agency_id'));
        } else {
            serviceLocator.pathLayerManager.showLineId(props.line.getId());
        }
        setLineIsHidden(false);
    };

    const hideOnMap = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (serviceLocator.keyboardManager.keyIsPressed('alt')) {
            serviceLocator.pathLayerManager.hideAllLinesForAgency(props.line.get('agency_id'));
        } else {
            serviceLocator.pathLayerManager.hideLineId(props.line.getId());
        }
        setLineIsHidden(true);
    };

    const isFrozen = props.line.isFrozen();
    const pathsCount = props.line.paths.length;
    const scheduledServicesCount =
        props.line.attributes.service_ids !== undefined
            ? props.line.attributes.service_ids.length
            : Object.keys(props.line.attributes.scheduleByServiceId).length;

    return (
        <Button
            key={props.line.getId()}
            isSelected={lineIsSelected}
            flushActionButtons={false}
            onSelect={{ handler: onSelect }}
            onDuplicate={{ handler: onDuplicate, altText: props.t('transit:transitLine:DuplicateLine') }}
            onDelete={
                !isFrozen && !lineIsSelected
                    ? {
                        handler: onDelete,
                        message: props.t('transit:transitLine:ConfirmDelete'),
                        altText: props.t('transit:transitLine:Delete')
                    }
                    : undefined
            }
        >
            <ButtonCell alignment="left">
                <span className="_circle-button" style={{ backgroundColor: props.line.attributes.color }}></span>
                {lineIsHidden === true && (
                    <span className="_list-element" onClick={showOnMap} title={props.t('main:Show')}>
                        <img
                            className="_list-element _icon-alone"
                            src={'/dist/images/icons/interface/hidden_white.svg'}
                            alt={props.t('main:Show')}
                            title={props.t('main:Show')}
                        />
                    </span>
                )}
                {lineIsHidden === false && (
                    <span className="_list-element" onClick={hideOnMap} title={props.t('main:Hide')}>
                        <img
                            className="_list-element _icon-alone"
                            src={'/dist/images/icons/interface/visible_white.svg'}
                            alt={props.t('main:Hide')}
                            title={props.t('main:Hide')}
                        />
                    </span>
                )}
                <img
                    className="_list-element _icon-alone"
                    src={`/dist/images/icons/transit/modes/${props.line.attributes.mode}_white.svg`}
                    alt={props.t(`transit:transitLine:modes:${props.line.attributes.mode}`)}
                    title={props.t(`transit:transitLine:modes:${props.line.attributes.mode}`)}
                />
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
            <ButtonCell alignment="left">{props.line.attributes.shortname}</ButtonCell>
            <ButtonCell alignment="left">{props.line.attributes.longname}</ButtonCell>
            <ButtonCell alignment="flush">
                {pathsCount > 1
                    ? props.t('transit:transitLine:nPaths', { n: pathsCount })
                    : props.t('transit:transitLine:nPath', { n: pathsCount })}{' '}
                {scheduledServicesCount > 0 && (
                    <span className="_list-element">
                        {scheduledServicesCount > 1
                            ? props.t('transit:transitLine:nServices', { n: scheduledServicesCount })
                            : props.t('transit:transitLine:nService', { n: scheduledServicesCount })}
                    </span>
                )}
            </ButtonCell>
        </Button>
    );
};

export default withTranslation(['transit', 'main', 'notifications'])(TransitLineButton);
