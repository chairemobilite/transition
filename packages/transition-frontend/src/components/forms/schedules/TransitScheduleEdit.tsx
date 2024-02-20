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
            serviceLocator.selectedObjectsManager.update('line', line);
            serviceLocator.selectedObjectsManager.deselect('schedule');
        } else {
            serviceLocator.eventManager.emit('progress', { name: 'DeletingSchedule', progress: 0.0 });
            try {
                await schedule.delete(serviceLocator.socketEventManager);
                line.removeSchedule(serviceId);
                serviceLocator.selectedObjectsManager.update('line', line);
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
            serviceLocator.selectedObjectsManager.update('schedule', schedule);
        } else {
            line.updateSchedule(schedule);
            serviceLocator.selectedObjectsManager.updateAndValidate('schedule', schedule);
        }
    }

    onChangePeriodsGroup(periodsGroupShortname: string) {
        const line = this.props.line;
        const schedule = this.props.schedule;
        schedule.set('periods_group_shortname', periodsGroupShortname);
        if (schedule.isNew()) {
            serviceLocator.selectedObjectsManager.update('schedule', schedule);
        } else {
            line.updateSchedule(schedule);
            serviceLocator.selectedObjectsManager.updateAndValidate('schedule', schedule);
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
                serviceLocator.selectedObjectsManager.update('line', line);
                serviceLocator.selectedObjectsManager.deselect('schedule');
            } finally {
                serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 1.0 });
            }
        } else {
            serviceLocator.selectedObjectsManager.update('schedule', schedule);
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

                const periodName = period.name[this.props.i18n.language];
                const periodShortname = period.shortname;
                const periodStartAtTimeStr = decimalHourToTimeStr(period.startAtHour);
                const periodEndAtTimeStr = decimalHourToTimeStr(period.endAtHour);

                const schedulePeriod = schedule.attributes.periods[i] || {
                    period_shortname: periodShortname,
                    start_at_hour: period.startAtHour,
                    end_at_hour: period.endAtHour
                };
                schedule.attributes.periods[i] = schedulePeriod;

                const trips = schedulePeriod.trips || [];
                const tripsCount = trips.length;

                const actualOutboundPathId = schedulePeriod.outbound_path_id;
                let outboundPathId = actualOutboundPathId;
                const actualInboundPathId = schedulePeriod.inbound_path_id;
                let inboundPathId = actualInboundPathId;
                if (_isBlank(outboundPathId) && outboundPathsChoices.length === 1) {
                    outboundPathId = outboundPathsChoices[0].value; // set to outbound path if only one exists
                    schedulePeriod.outbound_path_id = outboundPathId;
                }
                if (_isBlank(inboundPathId) && inboundPathsChoices.length === 1) {
                    inboundPathId = inboundPathsChoices[0].value; // set to inbound path if only one exists
                    schedulePeriod.inbound_path_id = inboundPathId;
                }

                const outboundTripsCells: any[] = [];
                const inboundTripsCells: any[] = [];
                const tripRows: any[] = [];
                for (let tripI = 0; tripI < tripsCount; tripI++) {
                    const trip = trips[tripI];
                    if (outboundPathIds.includes(trip.path_id)) {
                        // outbound trip
                        outboundTripsCells.push(
                            <td key={`outboundTrip_${tripI}`}>
                                {secondsSinceMidnightToTimeStr(
                                    trip.departure_time_seconds,
                                    true,
                                    allowSecondsBasedSchedules
                                )}
                            </td>
                        );
                    } else if (inboundPathIds.includes(trip.path_id)) {
                        inboundTripsCells.push(
                            <td key={`inboundTrip_${tripI}`}>
                                {secondsSinceMidnightToTimeStr(
                                    trip.departure_time_seconds,
                                    true,
                                    allowSecondsBasedSchedules
                                )}
                            </td>
                        );
                    }
                }
                const totalNumberOfTripRows = Math.max(outboundTripsCells.length, inboundTripsCells.length);

                for (let rowI = 0; rowI < totalNumberOfTripRows; rowI++) {
                    tripRows.push(
                        <tr key={rowI}>
                            {outboundTripsCells[rowI] || <td key={`emptyOutboundTrip_${rowI}`}></td>}
                            {inboundTripsCells[rowI] || <td key={`emptyInboundTrip_${rowI}`}></td>}
                        </tr>
                    );
                }

                const intervalSeconds = schedulePeriod.interval_seconds;
                const calculatedIntervalSeconds = schedulePeriod.calculated_interval_seconds;
                const numberOfUnits = schedulePeriod.number_of_units;
                const calculatedNumberOfUnits = schedulePeriod.calculated_number_of_units;
                const customStartAtStr =
                    schedulePeriod.custom_start_at_str || decimalHourToTimeStr(period.startAtHour) || undefined;
                const customEndAtStr = schedulePeriod.custom_end_at_str || undefined;

                /* temporary for calculations: TODO Do we really need this? */
                line.attributes.data.tmpIntervalSeconds = intervalSeconds || calculatedIntervalSeconds;
                line.attributes.data.tmpNumberOfUnits = numberOfUnits || calculatedNumberOfUnits;
                /* */

                const periodsForm = (
                    <div
                        className="tr__form-section _flex-container-row"
                        key={periodShortname}
                        style={{
                            borderRight: '1px solid rgba(255,255,255,0.2)',
                            alignItems: 'flex-start',
                            minWidth: '20rem'
                        }}
                    >
                        <h4 className="_aside-heading-container" style={{ minHeight: '30rem' }}>
                            <span className="_aside-heading">
                                <FontAwesomeIcon icon={faClock} className="_icon" />{' '}
                                <span className="_strong">{periodStartAtTimeStr}</span>{' '}
                                <FontAwesomeIcon icon={faArrowDown} className="_icon" />{' '}
                                <span className="_strong">{periodEndAtTimeStr}</span> <span>• {periodName}</span>
                            </span>
                        </h4>
                        <div className="tr__form-section">
                            <div className="tr__form-section">
                                <div className="apptr__form-input-container">
                                    <label>{this.props.t('transit:transitSchedule:OutboundPath')}</label>
                                    <InputSelect
                                        id={`formFieldTransitScheduleOutboundPathPeriod${periodShortname}${scheduleId}`}
                                        value={outboundPathId}
                                        choices={outboundPathsChoices}
                                        disabled={isFrozen}
                                        t={this.props.t}
                                        onValueChange={(e) =>
                                            this.onValueChange(`periods[${i}].outbound_path_id`, {
                                                value: e.target.value
                                            })
                                        }
                                    />
                                </div>
                                <div className="apptr__form-input-container">
                                    <label>{this.props.t('transit:transitSchedule:InboundPath')}</label>
                                    <InputSelect
                                        id={`formFieldTransitScheduleInboundPathPeriod${periodShortname}${scheduleId}`}
                                        value={inboundPathId}
                                        choices={inboundPathsChoices}
                                        disabled={isFrozen}
                                        t={this.props.t}
                                        onValueChange={(e) =>
                                            this.onValueChange(`periods[${i}].inbound_path_id`, {
                                                value: e.target.value
                                            })
                                        }
                                    />
                                </div>
                                {allowSecondsBasedSchedules !== true && (
                                    <div className="apptr__form-input-container">
                                        <label>{this.props.t('transit:transitSchedule:IntervalMinutes')}</label>
                                        <InputStringFormatted
                                            id={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}`}
                                            disabled={isFrozen}
                                            value={intervalSeconds}
                                            onValueUpdated={(value) =>
                                                this.onValueChange(`periods[${i}].interval_seconds`, value)
                                            }
                                            key={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}${this.resetChangesCount}`}
                                            stringToValue={minutesToSeconds}
                                            valueToString={(val) => _toString(secondsToMinutes(val))}
                                        />
                                    </div>
                                )}
                                {allowSecondsBasedSchedules === true && (
                                    <div className="apptr__form-input-container">
                                        <label>{this.props.t('transit:transitSchedule:IntervalSeconds')}</label>
                                        <InputStringFormatted
                                            id={`formFieldTransitScheduleIntervalSecondsPeriod${periodShortname}${scheduleId}`}
                                            disabled={isFrozen}
                                            value={intervalSeconds}
                                            stringToValue={_toInteger}
                                            valueToString={_toString}
                                            key={`formFieldTransitScheduleIntervalMinutesPeriod${periodShortname}${scheduleId}${this.resetChangesCount}`}
                                            onValueUpdated={(value) =>
                                                this.onValueChange(`periods[${i}].interval_seconds`, value)
                                            }
                                        />
                                    </div>
                                )}
                                <p className="_small _oblique">
                                    {!intervalSeconds && calculatedIntervalSeconds && numberOfUnits
                                        ? `${this.props.t('transit:transitSchedule:CalculatedInterval')}: ${Math.ceil(
                                            calculatedIntervalSeconds / 60
                                        )} ${this.props.t('main:minuteAbbr')}`
                                        : ''}
                                </p>
                                <div className="apptr__form-input-container">
                                    <label>{this.props.t('transit:transitSchedule:NumberOfUnits')}</label>
                                    <InputStringFormatted
                                        id={`formFieldTransitScheduleNumberOfUnitsPeriod${periodShortname}${scheduleId}`}
                                        disabled={isFrozen}
                                        value={numberOfUnits}
                                        stringToValue={_toInteger}
                                        valueToString={_toString}
                                        key={`formFieldTransitScheduleNumberOfUnitsPeriod${periodShortname}${scheduleId}${this.resetChangesCount}`}
                                        onValueUpdated={(value) =>
                                            this.onValueChange(`periods[${i}].number_of_units`, value)
                                        }
                                    />
                                </div>
                                <p className="_small _oblique">
                                    {!numberOfUnits && calculatedNumberOfUnits && intervalSeconds
                                        ? `${roundToDecimals(calculatedNumberOfUnits, 1)} ${this.props.t(
                                            'transit:transitSchedule:requiredUnits'
                                        )}`
                                        : ''}
                                </p>
                                <div className="apptr__form-input-container">
                                    <label>{this.props.t('transit:transitSchedule:CustomStartAt')}</label>
                                    <InputString
                                        id={`formFieldTransitScheduleCustomStartAtPeriod${periodShortname}${scheduleId}`}
                                        disabled={isFrozen}
                                        value={customStartAtStr}
                                        onValueUpdated={(value) =>
                                            this.onValueChange(`periods[${i}].custom_start_at_str`, value)
                                        }
                                    />
                                </div>
                                <div className="apptr__form-input-container">
                                    <label>{this.props.t('transit:transitSchedule:CustomEndAt')}</label>
                                    <InputString
                                        id={`formFieldTransitScheduleCustomEndAtPeriod${periodShortname}${scheduleId}`}
                                        disabled={isFrozen}
                                        value={customEndAtStr}
                                        onValueUpdated={(value) =>
                                            this.onValueChange(`periods[${i}].custom_end_at_str`, value)
                                        }
                                    />
                                </div>
                            </div>
                            <div className="tr__form-section">
                                {isFrozen !== true && (
                                    <div className="tr__form-buttons-container _left">
                                        {!_isBlank(outboundPathId) &&
                                            ((!_isBlank(intervalSeconds) && _isBlank(numberOfUnits)) ||
                                                (!_isBlank(numberOfUnits) && _isBlank(intervalSeconds))) && (
                                            <Button
                                                color="blue"
                                                icon={faSyncAlt}
                                                iconClass="_icon"
                                                label={this.props.t('transit:transitSchedule:GenerateSchedule')}
                                                onClick={function () {
                                                    const response = schedule.generateForPeriod(periodShortname);
                                                    if (response.trips) {
                                                        schedule.set(`periods[${i}].trips`, response.trips);
                                                    }
                                                    serviceLocator.selectedObjectsManager.update(
                                                        'schedule',
                                                        schedule
                                                    );
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                                {isFrozen !== true && tripsCount > 0 && (
                                    <div className="tr__form-buttons-container _left">
                                        <Button
                                            color="red"
                                            icon={faTrash}
                                            iconClass="_icon"
                                            label={this.props.t('transit:transitSchedule:RemoveSchedule')}
                                            onClick={function () {
                                                schedule.set(`periods[${i}].trips`, []);
                                                serviceLocator.selectedObjectsManager.update('schedule', schedule);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            {tripsCount > 0 && (
                                <div className="tr__form-section">
                                    <table className="_schedule">
                                        <tbody>
                                            <tr>
                                                <th>{this.props.t('transit:transitPath:directions:outbound')}</th>
                                                <th>{this.props.t('transit:transitPath:directions:inbound')}</th>
                                            </tr>
                                            {tripRows}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                );
                periodsForms.push(periodsForm);
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
                                    serviceLocator.selectedObjectsManager.update('line', line);
                                    serviceLocator.selectedObjectsManager.update('schedule', schedule);
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
                                    serviceLocator.selectedObjectsManager.update('line', line);
                                    serviceLocator.selectedObjectsManager.update('schedule', schedule);
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

export default withTranslation(['transit', 'main', 'form', 'notifications'])(TransitScheduleEdit);
