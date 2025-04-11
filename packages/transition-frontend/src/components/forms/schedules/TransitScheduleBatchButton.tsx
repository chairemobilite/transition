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
import InputCheckbox from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

interface ScheduleBatchButtonProps extends WithTranslation {
    line: Line;
    selectedLines?: Line[];
    onObjectSelected?: (objectId: string) => void;
}

const TransitScheduleBatchButton: React.FunctionComponent<ScheduleBatchButtonProps> = (props: ScheduleBatchButtonProps) => {
    let lineIsSelected = (props.selectedLines && props.selectedLines.some((selectedLine) => selectedLine.getId() === props.line.getId())) || false;
    const lineId = props.line.getId()
    const onSelect: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        await props.line.refreshSchedules(serviceLocator.socketEventManager);
        props.line.startEditing();
        if (props.onObjectSelected) {
            props.onObjectSelected(props.line.getId());
        }

        serviceLocator.selectedObjectsManager.select('batchLineSelect', [props.line]);
    };

    const onValueChange = (value) => {
        console.log(value)
        lineIsSelected = value
    }

    const onDelete: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }

        const lineHasPaths = props.line.hasPaths();

        serviceLocator.eventManager.emit('progress', { name: 'DeletingLine', progress: 0.0 });
        await props.line.delete(serviceLocator.socketEventManager);
        if (lineIsSelected) {
            serviceLocator.selectedObjectsManager.deselect('line');
            if (lineHasPaths) {
                // reload paths
                await serviceLocator.collectionManager.get('paths').loadFromServer(serviceLocator.socketEventManager);
                serviceLocator.collectionManager.refresh('paths');
                (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                    layerName: 'transitPaths',
                    data: serviceLocator.collectionManager.get('paths').toGeojson()
                });
            }
        }
        serviceLocator.eventManager.emit('progress', { name: 'DeletingLine', progress: 1.0 });
        serviceLocator.collectionManager.refresh('lines');
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
            <InputCheckbox
                id={`transitBatchLineSelect${lineId}`}
                label=" "
                value={lineIsSelected}
                disabled={isFrozen}
                sameLine={true}
                choices={[
                    {
                        value: false
                    },
                    {
                        value: true
                    }
                ]}
                localePrefix="transit:transitSchedule"
                t={props.t}
                isBoolean={true}
                onValueChange={(e) => onValueChange({ value: e.target.value })}
            />
            {/* <InputCheckboxBoolean
                id={`formFieldTransitAgencyEditIsFrozen${agencyId}`}
                label=" "
                isChecked={isFrozen}
                onValueChange={(e) => this.onValueChange('is_frozen', { value: e.target.value })}
            /> */}
            <ButtonCell alignment="left">
                <span className="_circle-button" style={{ backgroundColor: props.line.attributes.color }}></span>
                <img
                    className="_list-element _icon-alone"
                    src={`/dist/images/icons/transit/modes/${props.line.getAttributes().mode}_white.svg`}
                    alt={props.t(`transit:transitLine:modes:${props.line.getAttributes().mode}`)}
                    title={props.t(`transit:transitLine:modes:${props.line.getAttributes().mode}`)}
                />
            </ButtonCell>
            {/* {isFrozen && (
                <ButtonCell alignment="left">
                    <img
                        className="_icon-alone"
                        src={'/dist/images/icons/interface/lock_white.svg'}
                        alt={props.t('main:Locked')}
                    />
                </ButtonCell>
            )} */}
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

export default withTranslation(['transit', 'main', 'notifications'])(TransitScheduleBatchButton);
