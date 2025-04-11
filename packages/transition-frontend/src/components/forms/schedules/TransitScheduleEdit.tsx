/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _toString from 'lodash/toString';
import { withTranslation, WithTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUndoAlt } from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import { faRedoAlt } from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';
import { faSyncAlt } from '@fortawesome/free-solid-svg-icons/faSyncAlt';
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons/faTrashAlt';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputSelect, { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import { _isBlank, _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import {
    decimalHourToTimeStr,
    secondsSinceMidnightToTimeStr,
    secondsToMinutes,
    minutesToSeconds
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import Line from 'transition-common/lib/services/line/Line';
import TransitSchedulePeriod from './TransitSchedulePeriod';

interface ScheduleFormProps {
    schedule: Schedule;
    line: Line;
    /** Services that are available as choices for this schedule (not assigned to other schedules) */
    availableServices: choiceType[];
}

interface ScheduleFormState extends SaveableObjectState<Schedule> {
    scheduleErrors: string[];
}

class TransitScheduleEdit extends SaveableObjectForm<Schedule, ScheduleFormProps & WithTranslation, ScheduleFormState> {
    private resetChangesCount = 0;

    constructor(props: ScheduleFormProps & WithTranslation) {
        super(props);

        this.state = {
            object: props.schedule,
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            formValues: {},
            selectedObjectName: 'schedule',
            scheduleErrors: []
        };
    }

    // TODO Not the suggested approach, the 'object' should not be in the state after all, it is a prop (see issue #307)
    static getDerivedStateFromProps(props: any, state: ScheduleFormState) {
        if (props.schedule !== state.object) {
            return {
                object: props.schedule
            };
        }
        return null;
    }

    protected async onDelete(e: any): Promise<void> {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }

        const line = this.props.line;
        const schedule = this.props.schedule;
        const serviceId = schedule.attributes.service_id;

        if (schedule.isNew()) {
            serviceLocator.selectedObjectsManager.setSelection('line', [line]);
            serviceLocator.selectedObjectsManager.deselect('schedule');
        } else {
            serviceLocator.eventManager.emit('progress', { name: 'DeletingSchedule', progress: 0.0 });
            try {
                await schedule.delete(serviceLocator.socketEventManager);
                line.removeSchedule(serviceId);
                serviceLocator.selectedObjectsManager.setSelection('line', [line]);
                serviceLocator.selectedObjectsManager.deselect('schedule');
            } finally {
                serviceLocator.eventManager.emit('progress', { name: 'DeletingSchedule', progress: 1.0 });
            }
        }
    }

    onChangeService(toServiceId: string) {
        const line = this.props.line;
        const schedule = this.props.schedule;
        schedule.set('service_id', toServiceId);
        if (schedule.isNew()) {
            serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
        } else {
            line.updateSchedule(schedule);
            schedule.validate();
            serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
        }
    }

    onChangePeriodsGroup(periodsGroupShortname: string) {
        const line = this.props.line;
        const schedule = this.props.schedule;
        schedule.set('periods_group_shortname', periodsGroupShortname);
        if (schedule.isNew()) {
            serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
        } else {
            line.updateSchedule(schedule);
            schedule.validate();
            serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
        }
    }

    onSave = async () => {
        const line = this.props.line;
        const isFrozen = line.isFrozen();
        const schedule = this.props.schedule;
        // save
        if (isFrozen === true) {
            serviceLocator.selectedObjectsManager.deselect('schedule');
            return true;
        }
        schedule.validate();
        if (schedule.isValid) {
            serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 0.0 });
            try {
                await schedule.save(serviceLocator.socketEventManager);
                line.updateSchedule(schedule);
                serviceLocator.selectedObjectsManager.setSelection('line', [line]);
                serviceLocator.selectedObjectsManager.deselect('schedule');
            } finally {
                serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 1.0 });
            }
        } else {
            serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
        }
    };

    render() {
        const line = this.props.line;
        const isFrozen = line.isFrozen();
        line.refreshPaths();
        const paths = line.paths;
        const outboundPathIds: string[] = [];
        const outboundPathsChoices: choiceType[] = [];
        const inboundPathIds: string[] = [];
        const inboundPathsChoices: choiceType[] = [];
        const schedule = this.props.schedule;
        const scheduleId = schedule.getId();
        const allowSecondsBasedSchedules = schedule.attributes.allow_seconds_based_schedules || false;

        for (let i = 0, count = paths.length; i < count; i++) {
            const path = paths[i];
            if (['outbound', 'loop', 'other'].includes(path.attributes.direction)) {
                outboundPathIds.push(path.getId());
                outboundPathsChoices.push({
                    value: path.getId(),
                    label: `${path.toString(false)} (${this.props.t(
                        'transit:transitPath:directions:' + path.getAttributes().direction
                    )})`
                });
            } else if (path.get('direction') === 'inbound') {
                inboundPathIds.push(path.getId());
                inboundPathsChoices.push({
                    value: path.getId(),
                    label: `${path.toString(false)} (${this.props.t(
                        'transit:transitPath:directions:' + path.getAttributes().direction
                    )})`
                });
            }
        }

        const periodsGroups = Preferences.get('transit.periods');
        const periodsGroupShortname = schedule.attributes.periods_group_shortname || '';
        const periodsGroup = periodsGroupShortname ? periodsGroups[periodsGroupShortname] : null;
        const periodsGroupChoices = Object.keys(periodsGroups).map((periodsGroupShortname) => {
            const periodsGroup = periodsGroups[periodsGroupShortname];
            return {
                value: periodsGroupShortname,
                label: periodsGroup.name[this.props.i18n.language] || periodsGroupShortname
            };
        });

        const periodsForms: any[] = [];
        // TODO Extract the period form to sub-classes
        if (periodsGroupShortname && periodsGroup) {
            const periods = periodsGroup.periods;
            if (_isBlank(schedule.get('periods'))) {
                schedule.attributes.periods = [];
            }
            for (let i = 0, count = periods.length; i < count; i++) {
                const period = periods[i];

                const periodShortname = period.shortname;

                const schedulePeriod = schedule.attributes.periods[i] || {
                    period_shortname: periodShortname,
                    start_at_hour: period.startAtHour,
                    end_at_hour: period.endAtHour
                };
                schedule.attributes.periods[i] = schedulePeriod;

                periodsForms.push(
                    <TransitSchedulePeriod
                        key={`period_form_${periodShortname}`}
                        schedule={schedule}
                        line={line}
                        periodIndex={i}
                        period={period}
                        schedulePeriod={schedulePeriod}
                        outboundPathsChoices={outboundPathsChoices}
                        inboundPathsChoices={inboundPathsChoices}
                        outboundPathIds={outboundPathIds}
                        inboundPathIds={inboundPathIds}
                        isFrozen={isFrozen}
                        scheduleId={scheduleId}
                        allowSecondsBasedSchedules={allowSecondsBasedSchedules}
                        resetChangesCount={this.resetChangesCount}
                        onValueChange={this.onValueChange}
                    />
                );
            }
        }

        return (
            <form
                key={`tr__form-transit-schedule__id_${scheduleId}`}
                id={`tr__form-transit-schedule__id_${scheduleId}`}
                className="tr__form-transit-schedule apptr__form"
            >
                <div className="tr__form-section">
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:Service')}</label>
                        <InputSelect
                            disabled={isFrozen}
                            id={`formFieldTransitScheduleService${scheduleId}`}
                            value={schedule.attributes.service_id}
                            choices={this.props.availableServices}
                            t={this.props.t}
                            onValueChange={(e) => this.onChangeService(e.target.value)}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:PeriodsGroup')}</label>
                        <InputSelect
                            id={`formFieldTransitSchedulePeriodsGroup${scheduleId}`}
                            value={schedule.attributes.periods_group_shortname}
                            choices={periodsGroupChoices}
                            disabled={isFrozen}
                            t={this.props.t}
                            onValueChange={(e) => this.onChangePeriodsGroup(e.target.value)}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:AllowSecondsBasedSchedules')}</label>
                        <InputRadio
                            id={`formFieldTransitSchedulePeriodsGroup${scheduleId}`}
                            value={allowSecondsBasedSchedules}
                            disabled={isFrozen}
                            sameLine={true}
                            choices={[
                                {
                                    value: true
                                },
                                {
                                    value: false
                                }
                            ]}
                            localePrefix="transit:transitSchedule"
                            t={this.props.t}
                            isBoolean={true}
                            onValueChange={(e) =>
                                this.onValueChange('allow_seconds_based_schedules', { value: e.target.value })
                            }
                        />
                    </div>
                </div>

                <FormErrors errors={schedule.errors} />
                {this.hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}

                {this.state.confirmModalDeleteIsOpen && (
                    <ConfirmModal
                        isOpen={true}
                        title={this.props.t('transit:transitSchedule:ConfirmDelete')}
                        confirmAction={this.onDelete}
                        confirmButtonColor="red"
                        confirmButtonLabel={this.props.t('transit:transitSchedule:Delete')}
                        closeModal={this.closeDeleteConfirmModal}
                    />
                )}
                {this.state.confirmModalBackIsOpen && (
                    <ConfirmModal
                        isOpen={true}
                        title={this.props.t('main:ConfirmBackModal')}
                        confirmAction={this.onBack}
                        confirmButtonColor="blue"
                        confirmButtonLabel={this.props.t('main:DiscardChanges')}
                        cancelButtonLabel={this.props.t('main:Cancel')}
                        closeModal={this.closeBackConfirmModal}
                    />
                )}

                {
                    // TODO Use the SelectedObjectButtons instead
                }
                <div className="tr__form-buttons-container _left">
                    <span title={this.props.t('main:Back')}>
                        <Button
                            key="back"
                            color="blue"
                            icon={faArrowLeft}
                            iconClass="_icon-alone"
                            label=""
                            onClick={schedule.hasChanged() ? this.openBackConfirmModal : this.onBack}
                        />
                    </span>
                    {isFrozen !== true && (
                        <span title={this.props.t('main:Undo')}>
                            <Button
                                color="grey"
                                icon={faUndoAlt}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!schedule.canUndo()}
                                onClick={() => {
                                    schedule.undo();
                                    this.resetChangesCount++;
                                    serviceLocator.selectedObjectsManager.setSelection('line', [line]);
                                    serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
                                }}
                            />
                        </span>
                    )}
                    {isFrozen !== true && (
                        <span title={this.props.t('main:Redo')}>
                            <Button
                                color="grey"
                                icon={faRedoAlt}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!schedule.canRedo()}
                                onClick={() => {
                                    schedule.redo();
                                    this.resetChangesCount++;
                                    serviceLocator.selectedObjectsManager.setSelection('line', [line]);
                                    serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
                                }}
                            />
                        </span>
                    )}
                    <span title={this.props.t('main:Save')}>
                        <Button
                            icon={faCheckCircle}
                            iconClass="_icon"
                            label={this.props.t('transit:transitSchedule:SaveSchedule')}
                            onClick={this.onSave}
                        />
                    </span>
                    {isFrozen !== true && (
                        <span title={this.props.t('main:Delete')}>
                            <Button
                                icon={faTrashAlt}
                                iconClass="_icon-alone"
                                label=""
                                color="red"
                                onClick={this.openDeleteConfirmModal}
                            />
                        </span>
                    )}
                </div>
                <div className="_flex-container-row">{periodsForms}</div>
            </form>
        );
    }
}

export default withTranslation(['transit', 'main', 'notifications'])(TransitScheduleEdit);
