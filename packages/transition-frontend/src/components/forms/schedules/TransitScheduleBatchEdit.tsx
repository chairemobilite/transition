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
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons/faTrashAlt';
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
import saveUtils from 'chaire-lib-common/src/services/objects/SaveUtils'

interface ScheduleBatchFormProps {
    lines: Line[];
    schedules: Schedule[];
    availableServices: choiceType[];
}

interface ScheduleBatchFormState extends SaveableObjectState<Schedule> {
    scheduleErrors: string[];
}


class TransitScheduleBatchEdit extends SaveableObjectForm<Schedule, ScheduleBatchFormProps & WithTranslation, ScheduleBatchFormState> {
    private resetChangesCount = 0;
    private selectedServiceId = "";
    private selectedPeriodsGroup = "";
    constructor(props: ScheduleBatchFormProps & WithTranslation) {
        super(props);

        this.state = {
            object: props.schedules[0], // temporary solution, TODO ScheduleList class, extends Saveable & GenericObject
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            formValues: {},
            selectedObjectName: 'schedules',
            scheduleErrors: [],
        };

    }

    // static getDerivedStateFromProps(props: any, state: ScheduleFormState) {
    //     if (props.schedule !== state.object) {
    //         return {
    //             object: props.schedule
    //         };
    //     }
    //     return null;
    // }

    // protected async onDelete(e: any): Promise<void> {
    //     if (e && typeof e.stopPropagation === 'function') {
    //         e.stopPropagation();
    //     }

    //     const line = this.props.line;
    //     const schedule = this.props.schedule;
    //     const serviceId = schedule.attributes.service_id;

    //     if (schedule.isNew()) {
    //         serviceLocator.selectedObjectsManager.setSelection('line', [line]);
    //         serviceLocator.selectedObjectsManager.deselect('schedule');
    //     } else {
    //         serviceLocator.eventManager.emit('progress', { name: 'DeletingSchedule', progress: 0.0 });
    //         try {
    //             await schedule.delete(serviceLocator.socketEventManager);
    //             line.removeSchedule(serviceId);
    //             serviceLocator.selectedObjectsManager.setSelection('line', [line]);
    //             serviceLocator.selectedObjectsManager.deselect('schedule');
    //         } finally {
    //             serviceLocator.eventManager.emit('progress', { name: 'DeletingSchedule', progress: 1.0 });
    //         }
    //     }
    // }

    onChangeService(toServiceId: string) {
        const lines: Line[] = this.props.lines;
        const schedules: Schedule[] = this.props.schedules;
        this.selectedServiceId = toServiceId;
        let alreadyHasServiceLines = 0;
        schedules.forEach((schedule) => {
            const line = lines.find((line) => { return line.getId() === schedule.attributes.line_id })
            if (line) {
                if (line.attributes.service_ids && line.attributes.service_ids.includes(toServiceId)) {

                    alreadyHasServiceLines++;
                }
                schedule.set('service_id', toServiceId);
                if (schedule.isNew()) {
                    serviceLocator.selectedObjectsManager.setSelection('schedule', schedules); // ??
                } else {
                    line.updateSchedule(schedule);
                    schedule.validate();
                    serviceLocator.selectedObjectsManager.setSelection('schedule', schedules); // ???
                }
            }
        })
        schedules[0].errors = []
        if (alreadyHasServiceLines > 0) {
            if (alreadyHasServiceLines === 1) {
                schedules[0].errors.push(alreadyHasServiceLines + " line already has a schedule for this service, it will be overritten");
                console.log("already has one");
            }
            else {
                console.log("already has many");
                schedules[0].errors.push(alreadyHasServiceLines + " lines already have a schedule for this service, they will be overritten");
            }
        }
    }

    onChangePeriodsGroup(periodsGroupShortname: string) {
        const lines: Line[] = this.props.lines;
        const schedules: Schedule[] = this.props.schedules;
        this.selectedPeriodsGroup = periodsGroupShortname
        schedules.forEach((schedule) => {
            const line = lines.find((line) => { return line.getId() === schedule.attributes.line_id })
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

        })
    }

    onSave = async () => { // en attente fonction d'abdel
        const lines = this.props.lines;
        const schedules = this.props.schedules;
        // save

        schedules.forEach(async (schedule) => {
            schedule.validate();
            if (schedule.isValid) {
                const line = lines.find((line) => { return line.getId() === schedule.attributes.line_id })
                if (line) {
                    serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 0.0 });
                    serviceLocator.selectedObjectsManager.deselect('schedule');
                    try {
                        if (line.attributes.service_ids && line.attributes.service_ids.includes(schedule.attributes.service_id)){
                        }
                        await schedule.save(serviceLocator.socketEventManager)
                        line.updateSchedule(schedule)
                    } finally {
                        serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 1.0 });
                    }
                }
            } else {
                //serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
                console.log("schedule invalid")
            }
        })
        // serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 0.0 });
        // try {
        //     await saveUtils.saveAll<Schedule>(schedules, serviceLocator.socketEventManager, "transitSchedules", undefined);
        //     line.updateSchedule(schedule);
        //     // serviceLocator.selectedObjectsManager.setSelection('line', [line]);
        //     // serviceLocator.selectedObjectsManager.deselect('schedule');
        // } finally {
        //     serviceLocator.eventManager.emit('progress', { name: 'SavingSchedule', progress: 1.0 });
        // }
    };

    //TODO tout ce qu'il y a en bas

    render() {
        // const line = this.props.line;
        const lines = this.props.lines
        // const isFrozen = line.isFrozen();
        // line.refreshPaths();
        const outboundPathIds: string[] = [];
        // const outboundPathsChoices: choiceType[] = [];
        const inboundPathIds: string[] = [];
        // const inboundPathsChoices: choiceType[] = [];
        // const schedule = this.props.schedule;
        const schedules = this.props.schedules
        // const scheduleId = schedule.getId();
        // const allowSecondsBasedSchedules = schedule.attributes.allow_seconds_based_schedules || false;
        const allowSecondsBasedSchedules = schedules[0].attributes.allow_seconds_based_schedules || false;


        const periodsGroups = Preferences.get('transit.periods');
        // // const periodsGroupShortname = schedule.attributes.periods_group_shortname || '';pas sure sure
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
        // TODO Extract the period form to sub-classes
        if (periodsGroupShortname && periodsGroup) {
            const periods = periodsGroup.periods;
            schedules.forEach((schedule) => {
                if (_isBlank(schedule.get('periods'))) {
                    schedule.attributes.periods = [];
                }
            })
            for (let i = 0, count = periods.length; i < count; i++) {
                const period = periods[i];

                const periodShortname = period.shortname;
                const schedulePeriod = schedules[0].attributes.periods[i] || {
                    period_shortname: periodShortname,
                    start_at_hour: period.startAtHour,
                    end_at_hour: period.endAtHour
                };

                schedules.forEach((schedule) => {
                    schedule.attributes.periods[i] = schedulePeriod;
                })

                periodsForms.push(
                    <TransitScheduleBatchPeriod
                        key={`period_form_${periodShortname}`}
                        schedules={schedules}
                        lines={lines}
                        periodIndex={i}
                        period={period}
                        schedulePeriod={schedulePeriod}
                        allowSecondsBasedSchedules={allowSecondsBasedSchedules}
                        resetChangesCount={this.resetChangesCount}
                        onValueChange={this.onValueChange}
                    />
                );
            }
        }

        return (
            <form
                key={`tr__form-transit-schedule-batch`}
                id={`tr__form-transit-schedule-batch`}
                className="tr__form-transit-schedule apptr__form"
            >
                <div className="tr__form-section">
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:Service')}</label>
                        <InputSelect
                            id={`formFieldTransitScheduleBatchService`}
                            value={schedules[0].attributes.service_id}
                            choices={this.props.availableServices}
                            t={this.props.t}
                            onValueChange={(e) => this.onChangeService(e.target.value)}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:PeriodsGroup')}</label>
                        <InputSelect
                            id={`formFieldTransitScheduleBatchPeriodsGroup`}
                            //value={this.selectedPeriodsGroup}
                            value={schedules[0].attributes.periods_group_shortname}
                            choices={periodsGroupChoices}
                            t={this.props.t}
                            onValueChange={(e) => this.onChangePeriodsGroup(e.target.value)}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:transitSchedule:AllowSecondsBasedSchedules')}</label>
                        <InputRadio
                            id={`formFieldTransitSchedulePeriodsGroup`}
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
                            onClick={schedules[0].hasChanged() ? this.openBackConfirmModal : this.onBack}
                        />
                    </span>
                    {(
                        <span title={this.props.t('main:Undo')}>
                            <Button
                                color="grey"
                                icon={faUndoAlt}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!schedules[0].canUndo()} // might need to check all of them
                                onClick={() => {
                                    schedules.forEach((schedule) => { schedule.undo() });
                                    this.resetChangesCount++;
                                    // serviceLocator.selectedObjectsManager.setSelection('line', [line]);
                                    // serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
                                }}
                            />
                        </span>
                    )}
                    {(
                        <span title={this.props.t('main:Redo')}>
                            <Button
                                color="grey"
                                icon={faRedoAlt}
                                iconClass="_icon-alone"
                                label=""
                                disabled={!schedules[0].canRedo()}
                                onClick={() => {
                                    schedules.forEach((schedule) => { schedule.redo() });
                                    this.resetChangesCount++;
                                    // serviceLocator.selectedObjectsManager.setSelection('line', [line]);
                                    // serviceLocator.selectedObjectsManager.setSelection('schedule', [schedule]);
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
                    {/* {(
                        <span title={this.props.t('main:Delete')}>
                            <Button
                                icon={faTrashAlt}
                                iconClass="_icon-alone"
                                label=""
                                color="red"
                                onClick={this.openDeleteConfirmModal}
                            />
                        </span>
                    )} */}
                </div>
                <div className="_flex-container-row">{periodsForms}</div>
            </form>
        );
    }
}

export default withTranslation(['transit', 'main', 'notifications'])(TransitScheduleBatchEdit);
