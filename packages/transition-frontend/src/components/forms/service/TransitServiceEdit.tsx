/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';
import moment from 'moment';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputText from 'chaire-lib-frontend/lib/components/input/InputText';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import DayRange from 'chaire-lib-frontend/lib/components/input/DayRange';
import Calendar from 'chaire-lib-frontend/lib/components/input/Calendar';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import SelectedObjectButtons from 'chaire-lib-frontend/lib/components/pageParts/SelectedObjectButtons';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as ServiceUtils from '../../../services/transitService/TransitServiceUtils';
import Service, { serviceDays } from 'transition-common/lib/services/service/Service';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import TransitServiceFilterableList from './TransitServiceFilterableList';

interface ServiceFormProps extends WithTranslation {
    service: Service;
    serviceCollection: ServiceCollection;
}

interface ServiceFormState extends SaveableObjectState<Service> {
    mergedServices: any[];
    confirmModalMergeIsOpen: boolean;
    serviceErrors: string[];
}

class TransitServiceEdit extends SaveableObjectForm<Service, ServiceFormProps, ServiceFormState> {
    constructor(props: ServiceFormProps) {
        super(props);

        const service = this.props.service;
        this.state = {
            object: service,
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            confirmModalMergeIsOpen: false,
            mergedServices: [],
            // FIXME tahini: Not using the form values here because fields may change from other places (like merging services)
            formValues: {},
            selectedObjectName: 'service',
            collectionName: 'services',
            serviceErrors: []
        };
    }

    onDayRangeChange(range) {
        for (let i = 0; i < serviceDays.length; i++) {
            const currentValue = this.props.service.get(serviceDays[i]);
            if (range.includes(i) ? !currentValue : currentValue) {
                this.onValueChange(serviceDays[i], { value: range.includes(i) });
            }
        }
    }

    serviceDayToRange(service) {
        const currentDays: number[] = [];
        for (let i = 0; i < serviceDays.length; i++) {
            if (service.get(serviceDays[i])) {
                currentDays.push(i);
            }
        }
        return currentDays;
    }

    onValidityPeriodChange(startTime, endTime) {
        const start = moment(startTime).format('YYYY-MM-DD');
        if (start !== this.props.service.get('start_date')) {
            this.onValueChange('start_date', { value: start });
        }
        if (endTime) {
            const end = moment(endTime).format('YYYY-MM-DD');
            if (end !== this.props.service.get('end_date')) {
                this.onValueChange('end_date', { value: end });
            }
        }
    }

    onMergedServiceChange(data: string[]) {
        // Set the dates and days to the first merged service if not set yet
        const hasDates = this.props.service.get('start_date');
        const hasDays = this.props.service.get(serviceDays[0]);
        const isService = (s: Service | undefined): s is Service => s !== undefined;
        const servicesToMerge = data
            .map((serviceId) => this.props.serviceCollection.getById(serviceId))
            .filter(isService);
        if ((!hasDates || !hasDays) && servicesToMerge.length > 0) {
            const mergedService = servicesToMerge[0];
            if (mergedService && !hasDates) {
                this.props.service.set('start_date', mergedService.get('start_date'));
                this.props.service.set('end_date', mergedService.get('end_date'));
            }
            if (mergedService && !hasDays) {
                for (let i = 0, count = serviceDays.length; i < count; i++) {
                    this.props.service.set(serviceDays[i], mergedService.get(serviceDays[i]) === true);
                }
            }
        }
        if (servicesToMerge.length > 0) {
            const name =
                this.props.t('transit:transitService:MergeName') +
                servicesToMerge.map((s) => (s.getAttributes().name || '').substring(0, 10)).join(', ');
            this.props.service.set('name', name);
        }

        this.setState({
            mergedServices: data
        });
    }

    onSave = async () => {
        const service = this.props.service;
        const isFrozen = service.isFrozen();

        if (isFrozen === true && service.wasFrozen()) {
            serviceLocator.selectedObjectsManager.deselect('service');
            return true;
        }
        service.validate();
        const errors: string[] = [];
        if (service.isValid) {
            if (service.hasChanged()) {
                serviceLocator.eventManager.emit('progress', { name: 'SavingService', progress: 0.0 });
                try {
                    const response: any = await service.save(serviceLocator.socketEventManager);
                    if (response.error) {
                        // TODO Do not push error messages
                        errors.push(response.error);
                    }
                    // Start the post save action to merge services
                    const newId = response.id;
                    const mergedServices = this.props.serviceCollection
                        .getFeatures()
                        .filter((s) => this.state.mergedServices.includes(s.get('id')));
                    let savedOk = true;
                    if (mergedServices.length > 0) {
                        const messages = await ServiceUtils.mergeServices(newId, mergedServices, serviceLocator);
                        console.log(messages);
                        if (!(messages.length === 0)) {
                            const errors = messages.map(
                                (message) => message.line.get('shortname') + ' - ' + message.line.get('longname')
                            );
                            errors.push('transit:transitService:CannotMerge');
                            errors.push(errors.join(', '));
                            savedOk = false;
                        }
                    }
                    // End of service merge
                    this.setState({ mergedServices: [], serviceErrors: errors });
                    serviceLocator.collectionManager.refresh('services');
                    if (savedOk) {
                        serviceLocator.selectedObjectsManager.deselect('service');
                    }
                    serviceLocator.eventManager.emit('progress', { name: 'SavingService', progress: 1.0 });
                } catch (error) {
                    console.error('Error saving service', error);
                }
            } else {
                serviceLocator.selectedObjectsManager.deselect('service');
            }
        } else {
            serviceLocator.selectedObjectsManager.update('service', service);
        }
    };

    openMergeConfirmModal = (e) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        this.setState({
            confirmModalMergeIsOpen: true
        });
    };

    closeMergeConfirmModal = (e) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        this.setState({
            confirmModalMergeIsOpen: false
        });
    };

    render() {
        const service = this.props.service;
        const isFrozen = service.isFrozen();
        const serviceId = service.id;
        const isNew = service.isNew();

        const hasScheduledLines = service.hasScheduledLines();

        const servicesChoices: Service[] = [];
        if (isNew) {
            for (let i = 0, count = this.props.serviceCollection.size(); i < count; i++) {
                const mergee = this.props.serviceCollection.getFeatures()[i];
                if (ServiceUtils.canMergeServices(service, mergee)) {
                    // Enable choice if the service is compatible with the current dates and days?
                    servicesChoices.push(mergee);
                }
            }
        }

        return (
            <form
                id={isNew ? 'tr__form-transit-service-new' : `tr__form-transit-service-edit__id_${service.get('id')}`}
                className="tr__form-transit-service-edit apptr__form"
            >
                <div className="tr__form-sticky-header-container">
                    <h3>
                        {isNew
                            ? this.props.t('transit:transitService:New')
                            : this.props.t('transit:transitService:Edit')}
                        {service.toString(false) ? ` • ${service.toString(false)}` : ''}
                    </h3>
                    <SelectedObjectButtons
                        deleteAction={this.onDelete}
                        openDeleteConfirmModal={this.openDeleteConfirmModal}
                        backAction={this.onBack}
                        openBackConfirmModal={this.openBackConfirmModal}
                        object={service}
                        saveAction={this.state.mergedServices.length === 0 ? this.onSave : this.openMergeConfirmModal}
                    />
                </div>
                <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                    <div className="tr__form-section">
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitService:Name')}</label>
                            <InputString
                                id={`formFieldTransitServiceEditName${serviceId}`}
                                disabled={isFrozen}
                                value={service.getAttributes().name}
                                onValueUpdated={(value) => this.onValueChange('name', value)}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitService:DayRange')}</label>
                            <DayRange
                                id={`formFieldTransitServiceEditDays${serviceId}`}
                                onChange={(selection) => this.onDayRangeChange(selection)}
                                days={this.serviceDayToRange(service)}
                                disabled={isFrozen}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitService:ValidityPeriod')}</label>
                            <Calendar
                                id={`formFieldTransitServiceEditStartDate${serviceId}`}
                                onChange={(start, end) => this.onValidityPeriodChange(start, end)}
                                dateFormat="YYYY-MM-DD"
                                startDate={service.getAttributes().start_date}
                                endDate={service.getAttributes().end_date}
                                language={this.props.i18n.language}
                                disabled={isFrozen}
                            />
                        </div>
                        {isFrozen !== true && (
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitService:Color')}</label>
                                <InputColor
                                    id={`formFieldTransitServiceEditColor${serviceId}`}
                                    value={service.getAttributes().color}
                                    onValueChange={(e) => this.onValueChange('color', { value: e.target.value })}
                                    defaultColor={Preferences.get('transit.agencies.defaultColor', '#0086FF')}
                                />
                            </div>
                        )}
                    </div>
                </Collapsible>

                <Collapsible trigger={this.props.t('form:advancedFields')} transitionTime={100}>
                    <div className="tr__form-section">
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('main:Locked')}</label>
                            <InputCheckboxBoolean
                                id={`formFieldTransitServiceEditIsFrozen${serviceId}`}
                                label=" "
                                isChecked={isFrozen}
                                onValueChange={(e) => this.onValueChange('is_frozen', { value: e.target.value })}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitService:Uuid')}</label>
                            <InputString
                                disabled={true}
                                id={`formFieldTransitServiceEditUuid${serviceId}`}
                                value={serviceId}
                            />
                        </div>
                        <div className="apptr__form-input-container">
                            <label>{this.props.t('transit:transitService:Description')}</label>
                            <InputText
                                id={`formFieldTransitServiceEditDescription${serviceId}`}
                                disabled={isFrozen}
                                value={service.getAttributes().description}
                                onValueChange={(e) => this.onValueChange('description', { value: e.target.value })}
                            />
                        </div>
                    </div>
                </Collapsible>

                {isNew && (
                    <Collapsible
                        trigger={this.props.t('transit:transitService:Merge')}
                        open={true}
                        transitionTime={100}
                    >
                        <div className="tr__form-section">
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitService:Services')}</label>
                                <TransitServiceFilterableList
                                    services={servicesChoices}
                                    id={`formFieldTransitServiceEditMerge${serviceId}`}
                                    value={this.state.mergedServices}
                                    allowSelectAll={this.state.mergedServices.length > 0}
                                    onValueChange={(e) => this.onMergedServiceChange(e.target.value)}
                                />
                            </div>
                        </div>
                    </Collapsible>
                )}

                {this.state.object.getErrors() && <FormErrors errors={this.state.object.getErrors()} />}
                {this.state.serviceErrors && <FormErrors errors={this.state.serviceErrors} />}
                {this.hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}

                <div>
                    {this.state.confirmModalDeleteIsOpen && (
                        <ConfirmModal
                            isOpen={true}
                            title={
                                hasScheduledLines
                                    ? this.props.t('transit:transitService:ConfirmDeleteWithSchedule')
                                    : this.props.t('transit:transitService:ConfirmDelete')
                            }
                            confirmAction={this.onDelete}
                            confirmButtonColor="red"
                            confirmButtonLabel={this.props.t('transit:transitService:Delete')}
                            closeModal={this.closeDeleteConfirmModal}
                        />
                    )}
                    {this.state.confirmModalMergeIsOpen && (
                        <ConfirmModal
                            isOpen={true}
                            title={this.props.t('transit:transitService:ConfirmMerge')}
                            confirmAction={this.onSave}
                            confirmButtonColor="green"
                            confirmButtonLabel={this.props.t('transit:transitService:Merge')}
                            closeModal={this.closeMergeConfirmModal}
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
                </div>
            </form>
        );
    }
}

export default withTranslation(['transit', 'main', 'form', 'notifications'])(TransitServiceEdit);
