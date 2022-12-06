/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faWindowClose } from '@fortawesome/free-solid-svg-icons/faWindowClose';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Line from 'transition-common/lib/services/line/Line';
import { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import TransitScheduleEdit from './TransitScheduleEdit';
import TransitScheduleButton from './TransitScheduleButton';
import ButtonList from '../../parts/ButtonList';

interface ScheduleListProps extends WithTranslation {
    selectedSchedule?: Schedule;
    selectedLine: Line;
}

const TransitScheduleList: React.FunctionComponent<ScheduleListProps> = (props: ScheduleListProps) => {
    const isFrozen = props.selectedLine.isFrozen();
    props.selectedLine.refreshPaths();
    const scheduleByServiceId = props.selectedLine.attributes.scheduleByServiceId;
    const activeServiceIds: string[] = Object.keys(scheduleByServiceId);
    const transitServices = serviceLocator.collectionManager.get('services');

    const scheduleButtons = Object.keys(scheduleByServiceId).map((serviceId) => {
        const schedule = new Schedule(scheduleByServiceId[serviceId], false, serviceLocator.collectionManager);
        schedule.startEditing();
        return (
            <TransitScheduleButton
                key={schedule.id}
                schedule={schedule}
                selectedSchedule={props.selectedSchedule}
                line={props.selectedLine}
            />
        );
    });

    const serviceChoices: choiceType[] = [];
    if (transitServices && transitServices.size() > 0) {
        const serviceFeatures = transitServices.getFeatures();
        for (let i = 0, count = transitServices.size(); i < count; i++) {
            const serviceFeature = serviceFeatures[i];
            if (
                !activeServiceIds.includes(serviceFeature.id) ||
                (props.selectedSchedule && props.selectedSchedule.attributes.service_id === serviceFeature.id)
            ) {
                serviceChoices.push({
                    value: serviceFeature.id,
                    label: serviceFeature.toString(false)
                });
            }
        }
    }

    return (
        <div>
            <h3>
                <img
                    src={'/dist/images/icons/transit/schedule_white.svg'}
                    className="_icon"
                    alt={props.t('transit:transitSchedule:Schedules')}
                />{' '}
                {props.t('transit:transitSchedule:Schedules')}
                {props.selectedLine.toString(false) ? ` • ${props.selectedLine.toString(false)}` : ''}
            </h3>
            <ButtonList key="schedules">{scheduleButtons}</ButtonList>

            {transitServices.size() === 0 && (
                <div className="apptr__form-errors-container">
                    <p className="apptr__form-error-message _strong _center">
                        {props.t('transit:transitSchedule:errors:NoServiceInServiceCollection')}
                    </p>
                </div>
            )}

            <div className="tr__form-buttons-container _left">
                {serviceChoices.length > 0 && isFrozen !== true && (
                    <Button
                        color="blue"
                        icon={faPlus}
                        iconClass="_icon"
                        label={props.t('transit:transitSchedule:NewSchedule')}
                        onClick={function () {
                            // new
                            serviceLocator.selectedObjectsManager.select(
                                'schedule',
                                new Schedule(
                                    { line_id: props.selectedLine.getId() },
                                    true,
                                    serviceLocator.collectionManager
                                )
                            );
                        }}
                    />
                )}
                {!props.selectedSchedule && (
                    <Button
                        color="grey"
                        icon={faWindowClose}
                        iconClass="_icon"
                        label={props.t('transit:transitSchedule:CloseSchedulesWindow')}
                        onClick={function () {
                            // close
                            serviceLocator.eventManager.emit('fullSizePanel.hide');
                        }}
                    />
                )}
            </div>
            {props.selectedSchedule && (
                <TransitScheduleEdit
                    availableServices={serviceChoices}
                    schedule={props.selectedSchedule}
                    line={props.selectedLine}
                />
            )}
        </div>
    );
};

export default withTranslation(['transit', 'main', 'form', 'notifications'])(TransitScheduleList);
