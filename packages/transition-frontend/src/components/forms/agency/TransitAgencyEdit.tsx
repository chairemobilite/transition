/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import _get from 'lodash/get';
import timezones from 'timezone/zones';
import { withTranslation, WithTranslation } from 'react-i18next';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputText from 'chaire-lib-frontend/lib/components/input/InputText';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import InputMultiselect from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import SelectedObjectButtons from 'chaire-lib-frontend/lib/components/pageParts/SelectedObjectButtons';
import CollectionDownloadButtons from 'chaire-lib-frontend/lib/components/pageParts/CollectionDownloadButtons';
import Agency from 'transition-common/lib/services/agency/Agency';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

const timezoneZoneChoices: { label: string; value: string }[] = [];
for (let i = 0, countI = timezones.length; i < countI; i++) {
    const zones = timezones[i];
    for (let j = 0, countJ = zones.length; j < countJ; j++) {
        const zone = zones[j];
        if (zone.zones) {
            for (const zoneName in zone.zones) {
                timezoneZoneChoices.push({
                    label: zoneName,
                    value: zoneName
                });
            }
        }
    }
}

interface AgencyFormProps extends WithTranslation {
    agency: Agency;
}

interface AgencyFormState extends SaveableObjectState<Agency> {
    agencyErrors: string[];
}

class TransitAgencyEdit extends SaveableObjectForm<Agency, AgencyFormProps, AgencyFormState> {
    constructor(props: AgencyFormProps) {
        super(props);

        const agency = this.props.agency;
        this.state = {
            object: agency,
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            // FIXME tahini: Not using the form values here because fields may change from other places (like merging services)
            formValues: {},
            selectedObjectName: 'agency',
            collectionName: 'agencies',
            agencyErrors: []
        };
    }

    protected async onDelete(e: any): Promise<void> {
        const agency = this.props.agency;
        const updateLines = !agency.isNew() && agency.hasLines();

        // Delete the object as usual
        await super.onDelete(e);

        // Update lines and path collections if required
        if (updateLines) {
            try {
                await serviceLocator.collectionManager.get('paths').loadFromServer(serviceLocator.socketEventManager);
                serviceLocator.collectionManager.refresh('paths');
                (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                    layerName: 'transitPaths',
                    data: serviceLocator.collectionManager.get('paths').toGeojson()
                });
                serviceLocator.collectionManager
                    .get('lines')
                    .loadFromServer(serviceLocator.socketEventManager, serviceLocator.collectionManager);

                await serviceLocator.collectionManager.get('paths').loadFromServer(serviceLocator.socketEventManager);
                serviceLocator.collectionManager.refresh('lines');
                serviceLocator.collectionManager.refresh('agencies');
            } catch (e) {
                console.error('Error updating paths and lines after deleting agency: ', e);
            }
        }
    }

    render() {
        const agency = this.props.agency;
        const agencyId = agency.getId();
        const isFrozen = agency.isFrozen();
        agency.refreshLines();
        agency.refreshUnits();
        agency.refreshGarages();

        return (
            <React.Fragment>
                <form
                    id={
                        agency.isNew()
                            ? 'tr__form-transit-agency-new'
                            : `tr__form-transit-agency-edit__id_${agency.get('id')}`
                    }
                    className="tr__form-transit-agency-edit apptr__form"
                >
                    <div className="tr__form-sticky-header-container">
                        <h3>
                            {agency.isNew()
                                ? this.props.t('transit:transitAgency:New')
                                : this.props.t('transit:transitAgency:Edit')}
                            {agency.toString(false) ? ` • ${agency.toString(false)}` : ''}
                        </h3>
                        <SelectedObjectButtons
                            onDelete={this.onDelete}
                            openDeleteConfirmModal={this.openDeleteConfirmModal}
                            backAction={this.onBack}
                            openBackConfirmModal={this.openBackConfirmModal}
                            object={agency}
                        />
                    </div>
                    <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                        <div className="tr__form-section">
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitAgency:Acronym')}</label>
                                <InputString
                                    id={`formFieldTransitAgencyEditAcronym${agencyId}`}
                                    value={agency.attributes.acronym}
                                    disabled={isFrozen}
                                    onValueUpdated={(value) => this.onValueChange('acronym', value)}
                                />
                            </div>
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitAgency:Name')}</label>
                                <InputString
                                    id={`formFieldTransitAgencyEditName${agencyId}`}
                                    value={agency.attributes.name}
                                    disabled={isFrozen}
                                    onValueUpdated={(value) => this.onValueChange('name', value)}
                                />
                            </div>
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitAgency:Url')}</label>
                                <InputString
                                    id={`formFieldTransitAgencyEditUrl${agencyId}`}
                                    value={agency.attributes.data.gtfs?.agency_url}
                                    disabled={isFrozen}
                                    onValueUpdated={(value) => this.onValueChange('data.gtfs.agency_url', value)}
                                />
                            </div>
                            {isFrozen !== true && (
                                <div className="apptr__form-input-container _two-columns">
                                    <label>{this.props.t('transit:transitAgency:Color')}</label>
                                    <InputColor
                                        id={`formFieldTransitAgencyEditColor${agencyId}`}
                                        value={agency.attributes.color}
                                        onValueChange={(e) => this.onValueChange('color', { value: e.target.value })}
                                        defaultColor={_get(
                                            Preferences.current,
                                            'transit.agencies.defaultColor',
                                            '#0086FF'
                                        )}
                                    />
                                </div>
                            )}
                            <div className="apptr__form-input-container">
                                <label className="_flex">{this.props.t('transit:transitAgency:Timezone')}</label>
                                <InputMultiselect
                                    // TODO: Can there really be multiple time zones?
                                    id={`formFieldTransitAgencyEditTimezone${agencyId}`}
                                    value={
                                        agency.attributes.data.gtfs?.agency_timezone
                                            ? [agency.attributes.data.gtfs?.agency_timezone]
                                            : []
                                    }
                                    choices={timezoneZoneChoices}
                                    disabled={isFrozen}
                                    multiple={false}
                                    onValueChange={(e) =>
                                        this.onValueChange('data.gtfs.agency_timezone', { value: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                    </Collapsible>

                    <Collapsible trigger={this.props.t('form:advancedFields')} transitionTime={100}>
                        <div className="tr__form-section">
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('main:Locked')}</label>
                                <InputCheckboxBoolean
                                    id={`formFieldTransitAgencyEditIsFrozen${agencyId}`}
                                    label=" "
                                    isChecked={isFrozen}
                                    onValueChange={(e) => this.onValueChange('is_frozen', { value: e.target.value })}
                                />
                            </div>
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitAgency:Uuid')}</label>
                                <InputString
                                    disabled={true}
                                    id={`formFieldTransitAgencyEditUuid${agencyId}`}
                                    value={agencyId}
                                />
                            </div>
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitAgency:InternalId')}</label>
                                <InputString
                                    id={`formFieldTransitAgencyEditInternalId${agencyId}`}
                                    disabled={isFrozen}
                                    value={agency.attributes.internal_id}
                                    onValueUpdated={(value) => this.onValueChange('internal_id', value)}
                                />
                            </div>
                            <div className="apptr__form-input-container">
                                <label>{this.props.t('transit:transitAgency:Description')}</label>
                                <InputText
                                    id={`formFieldTransitAgencyEditDescription${agencyId}`}
                                    disabled={isFrozen}
                                    value={agency.attributes.description}
                                    onValueChange={(e) => this.onValueChange('description', { value: e.target.value })}
                                />
                            </div>
                        </div>
                    </Collapsible>

                    <FormErrors errors={agency.errors} />

                    <div>
                        {this.state.confirmModalDeleteIsOpen && (
                            <ConfirmModal
                                isOpen={true}
                                title={this.props.t('transit:transitAgency:ConfirmDelete')}
                                confirmAction={this.onDelete}
                                confirmButtonColor="red"
                                confirmButtonLabel={this.props.t('transit:transitAgency:Delete')}
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
                    </div>
                </form>
                <Collapsible trigger={this.props.t('form:export')} transitionTime={100}>
                    <h3 className="tr__form-buttons-container">{this.props.t('transit:transitLine:Lines')}</h3>
                    <CollectionDownloadButtons collection={agency.getLineCollection()} />

                    <h3 className="tr__form-buttons-container">{this.props.t('transit:transitPath:Paths')}</h3>
                    <CollectionDownloadButtons collection={agency.getPathCollection()} />
                </Collapsible>
            </React.Fragment>
        );
    }
}

export default withTranslation(['transit', 'main', 'form', 'notifications'])(TransitAgencyEdit);
