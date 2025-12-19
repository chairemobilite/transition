/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faUndoAlt } from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import { faRedoAlt } from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';
import InputSelect, { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import Line from 'transition-common/lib/services/line/Line';
import TransitScheduleBatchPeriod from './TransitScheduleBatchPeriod';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import { SchedulePeriod } from 'transition-common/lib/services/schedules/Schedule';
import LineCollection from 'transition-common/lib/services/line/LineCollection';

interface ScheduleBatchFormProps {
    lines: LineCollection;
    schedules: Schedule[];
    availableServices: choiceType[];
    onClose: (resetSelection: boolean) => void;
}

interface ScheduleBatchFormState extends SaveableObjectState<Schedule> {
    scheduleErrors: string[];
}

// FIXME this component is a variation of TransitScheduleEdit.
// As such, they should share a common implementation when possible.
// The props a slightly different. BatchEdit has a schedule[] and LineCollection.
// The service selection drop down and the logic behind it is different. In batchEdit,
// All the existing services are displayed, and when the user selects one and saves a schedule,
// the service is added to all the selected lines.
// BatchEdit has no delete schedule button.
// onChangePeriodGroups and OnSave are applied iteratively on all the selectedLines, instead of just one.

// The new shared component could simply always use a LineCollection, and contain a single line when
// doing single schedule modification.
class TransitScheduleBatchEdit extends SaveableObjectForm<
    Schedule,
    ScheduleBatchFormProps & WithTranslation,
    ScheduleBatchFormState
> {
    private resetChangesCount = 0;
    private selectedServiceId = '';
    private selectedPeriodsGroup = '';
    constructor(props: ScheduleBatchFormProps & WithTranslation) {
        super(props);

        this.state = {
            object: props.schedules[0],
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            formValues: {},
            selectedObjectName: 'schedules',
            scheduleErrors: []
        };
    }

    // Helper method to validate multiple schedules
    private getValidSchedulesWithLines(
        schedules: Schedule[],
        lines: LineCollection
    ): { validSchedules: Schedule[]; scheduleLineMap: Map<Schedule, Line> } {
        const validSchedules: Schedule[] = [];
        const scheduleLineMap = new Map();

        schedules.forEach((schedule) => {
            schedule.validate();
            const line = lines.getById(schedule.attributes.line_id);
            if (schedule.isValid) {
                if (line) {
                    validSchedules.push(schedule);
                    scheduleLineMap.set(schedule, line);
                }
            } else {
                console.log(
                    'The schedule for the line ' +
                        line?.getDisplayName() +
                        ' is not valid. \n Schedule object : ' +
                        schedule
                );
            }
        });

        return { validSchedules, scheduleLineMap };
    }

    onChangeService(toServiceId: string) {
        const lines: LineCollection = this.props.lines;
        const schedules: Schedule[] = this.props.schedules;
        this.selectedServiceId = toServiceId;
        let alreadyHasServiceLines = 0;
        schedules.forEach((schedule, index) => {
            const line = lines.getById(schedule.attributes.line_id);
            if (line) {
                if (line.attributes.service_ids && line.attributes.service_ids.includes(toServiceId)) {
                    schedule.attributes.integer_id = line.attributes.scheduleByServiceId[toServiceId].integer_id;
                    schedule.setNew(false);
                    alreadyHasServiceLines++;
                } else {
                    schedule.setNew(true);
                }
                schedules[index].set('service_id', toServiceId);
                if (!schedule.isNew()) {
                    schedule.validate();
                }
                serviceLocator.selectedObjectsManager.setSelection('schedule', schedules);
            }
        });
        schedules[0].errors = [];
        if (alreadyHasServiceLines > 0) {
            schedules[0].errors.push(
                this.props.t('transit:transitSchedule:OverwriteScheduleWarningBatch', { n: alreadyHasServiceLines })
            );
        }
    }

    onChangePeriodsGroup(periodsGroupShortname: string) {
        const lines: LineCollection = this.props.lines;
        const schedules: Schedule[] = this.props.schedules;
        this.selectedPeriodsGroup = periodsGroupShortname;
        schedules.forEach((schedule) => {
            const line = lines.getById(schedule.attributes.line_id);
            if (line) {
                schedule.set('periods_group_shortname', periodsGroupShortname);
                if (schedule.isNew()) {
                    serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
                } else {
                    line.updateSchedule(schedule);
                    schedule.validate();
                    serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
                }
            }
        });
    }

    onSave = async () => {
        const lines: LineCollection = this.props.lines;
        const schedules: Schedule[] = this.props.schedules;
        const { validSchedules, scheduleLineMap } = this.getValidSchedulesWithLines(schedules, lines);
        if (validSchedules.length > 0) {
            serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 0.0 });
            serviceLocator.selectedObjectsManager.deselect('schedule');

            try {
                await SaveUtils.saveAll(
                    validSchedules,
                    serviceLocator.socketEventManager,
                    'transitSchedules',
                    undefined
                );

                validSchedules.forEach(async (schedule) => {
                    const line = scheduleLineMap.get(schedule);
                    if (line) {
                        line.updateSchedule(schedule);
                        serviceLocator.collectionManager.refresh('lines');
                    }
                });
                await serviceLocator.collectionManager.get('lines').loadFromServer(serviceLocator.socketEventManager);
                this.props.onClose(true);
            } finally {
                serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 1.0 });
            }
        }
    };

    render() {
        const lines = this.props.lines;
        const schedules = this.props.schedules;
        const allowSecondsBasedSchedules = schedules[0].attributes.allow_seconds_based_schedules || false;
        const periodsGroups = Preferences.get('transit.periods');
        const periodsGroupShortname = schedules[0].attributes.periods_group_shortname || '';
        const periodsGroup = periodsGroupShortname ? periodsGroups[periodsGroupShortname] : null;
        const periodsGroupChoices = Object.keys(periodsGroups).map((periodsGroupShortname) => {
            const periodsGroup = periodsGroups[periodsGroupShortname];
            return {
                value: periodsGroupShortname,
                label: periodsGroup.name[this.props.i18n.language] || periodsGroupShortname
            };
        });

        const periodsForms: any[] = [];
        if (periodsGroupShortname && periodsGroup) {
            const periods = periodsGroup.periods;
            schedules.forEach((schedule) => {
                if (_isBlank(schedule.get('periods'))) {
                    schedule.attributes.periods = [];
                }
            });
            for (let i = 0, count = periods.length; i < count; i++) {
                const period = periods[i];
                const periodShortname = period.shortname;
                const schedulePeriods: SchedulePeriod[] = [];
                schedules.forEach((schedule) => {
                    const existingPeriod = schedule.attributes.periods[i];
                    const periodData = existingPeriod || {
                        period_shortname: periodShortname,
                        start_at_hour: period.startAtHour,
                        end_at_hour: period.endAtHour
                    };
                    // Save the period for this schedule
                    schedule.attributes.periods[i] = periodData;
                    // Collect it for the component
                    schedulePeriods.push(periodData);
                });

                periodsForms.push(
                    <TransitScheduleBatchPeriod
                        key={`period_form_${periodShortname}`}
                        schedules={schedules}
                        lines={lines}
                        periodIndex={i}
                        period={period}
                        schedulePeriods={schedulePeriods}
                        allowSecondsBasedSchedules={allowSecondsBasedSchedules}
                        resetChangesCount={this.resetChangesCount}
                        onValueChange={this.onValueChange}
                    />
                );
            }
        }

        return (
            <form
                key={'tr__form-transit-schedule-batch'}
                id={'tr__form-transit-schedule-batch'}
                className="tr__form-transit-schedule apptr__form"
            >
                <div className="tr__form-section">
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:Service')}</label>
                        <InputSelect
                            id={'formFieldTransitScheduleBatchService'}
                            value={schedules[0].attributes.service_id}
                            choices={this.props.availableServices}
                            t={this.props.t}
                            onValueChange={(e) => this.onChangeService(e.target.value)}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:PeriodsGroup')}</label>
                        <InputSelect
                            id={'formFieldTransitScheduleBatchPeriodsGroup'}
                            value={schedules[0].attributes.periods_group_shortname}
                            choices={periodsGroupChoices}
                            t={this.props.t}
                            onValueChange={(e) => this.onChangePeriodsGroup(e.target.value)}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:AllowSecondsBasedSchedules')}</label>
                        <InputRadio
                            id={'formFieldTransitSchedulePeriodsGroup'}
                            value={allowSecondsBasedSchedules}
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

                <FormErrors errors={schedules[0].errors} />
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
                        confirmAction={() => this.props.onClose(false)}
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
                            onClick={
                                schedules[0].hasChanged() ? this.openBackConfirmModal : () => this.props.onClose(false)
                            }
                        />
                    </span>
                    {
                        // TODO Make sure this works if needed
                        <span title={this.props.t('main:Undo')}>
                            <Button
                                color="grey"
                                icon={faUndoAlt}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!schedules[0].canUndo()}
                                onClick={() => {
                                    schedules.forEach((schedule) => {
                                        schedule.undo();
                                    });
                                    this.resetChangesCount++;
                                }}
                            />
                        </span>
                    }
                    {
                        <span title={this.props.t('main:Redo')}>
                            <Button
                                color="grey"
                                icon={faRedoAlt}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!schedules[0].canRedo()}
                                onClick={() => {
                                    schedules.forEach((schedule) => {
                                        schedule.redo();
                                    });
                                    this.resetChangesCount++;
                                }}
                            />
                        </span>
                    }
                    <span title={this.props.t('main:Save')}>
                        <Button
                            icon={faCheckCircle}
                            iconClass="_icon"
                            label={this.props.t('transit:transitSchedule:SaveSchedule')}
                            onClick={this.onSave}
                        />
                    </span>
                </div>
                <div className="_flex-container-row">{periodsForms}</div>
            </form>
        );
    }
}

export default withTranslation(['transit', 'main', 'notifications'])(TransitScheduleBatchEdit);
