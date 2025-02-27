/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import Line from 'transition-common/lib/services/line/Line';
import Button from '../../parts/Button';
import ButtonCell from '../../parts/ButtonCell';

interface ScheduleButtonProps extends WithTranslation {
    schedule: Schedule;
    selectedSchedule?: Schedule;
    line: Line;
}

const TransitScheduleButton: React.FunctionComponent<ScheduleButtonProps> = (props: ScheduleButtonProps) => {
    const onSelect: React.MouseEventHandler = (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        props.schedule.startEditing();
        serviceLocator.selectedObjectsManager.setSelection('line', [props.line]);
        serviceLocator.selectedObjectsManager.setSelection('schedule', [props.schedule]);
    };

    const onDelete: React.MouseEventHandler = async (e: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        const line = props.line;
        const schedule = props.schedule;

        serviceLocator.eventManager.emit('progress', { name: 'DeletingSchedule', progress: 0.0 });
        try {
            await schedule.delete(serviceLocator.socketEventManager);
            await line.refreshSchedules(serviceLocator.socketEventManager);
            const selectedSchedule = props.selectedSchedule;
            const scheduleIsSelected = selectedSchedule && selectedSchedule.getId() === schedule.getId();
            if (scheduleIsSelected) {
                serviceLocator.selectedObjectsManager.deselect('schedule');
            }
            serviceLocator.selectedObjectsManager.setSelection('line', [line]);
        } finally {
            serviceLocator.eventManager.emit('progress', { name: 'DeletingSchedule', progress: 1.0 });
        }
    };

    const isFrozen = props.line.isFrozen();
    const scheduleId = props.schedule.getId();
    const scheduleIsSelected = (props.selectedSchedule && props.selectedSchedule.getId() === scheduleId) || false;
    const serviceId = props.schedule.attributes.service_id;
    const periodsGroups = Preferences.get('transit.periods');
    const periodsGroupShortname = props.schedule.attributes.periods_group_shortname;
    const periodsGroupName = periodsGroupShortname
        ? periodsGroups[periodsGroupShortname].name[props.i18n.language]
        : '';
    const service = serviceLocator.collectionManager.get('services').getById(serviceId);
    const tripsCount = props.schedule.tripsCount();

    return (
        <Button
            key={scheduleId}
            isSelected={scheduleIsSelected}
            onSelect={{ handler: onSelect }}
            onDelete={
                !isFrozen
                    ? {
                        handler: onDelete,
                        message: props.t('transit:transitSchedule:ConfirmDelete'),
                        altText: props.t('transit:transitSchedule:Delete')
                    }
                    : undefined
            }
        >
            <ButtonCell alignment="left">
                {props.t('transit:transitSchedule:Service')}: {service ? service.toString() : '-'}
            </ButtonCell>
            <ButtonCell alignment="left">
                {props.t('transit:transitSchedule:Periods')}: {periodsGroupName}
            </ButtonCell>
            <ButtonCell alignment="flush">
                {tripsCount > 1
                    ? props.t('transit:transitSchedule:nTrips', { n: tripsCount })
                    : props.t('transit:transitSchedule:nTrip', { n: tripsCount })}
            </ButtonCell>
        </Button>
    );
};

export default withTranslation(['transit', 'notifications'])(TransitScheduleButton);
