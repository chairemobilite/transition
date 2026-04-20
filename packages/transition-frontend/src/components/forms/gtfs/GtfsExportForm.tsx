/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { faFileDownload } from '@fortawesome/free-solid-svg-icons/faFileDownload';
import { faTasks } from '@fortawesome/free-solid-svg-icons/faTasks';
import { withTranslation, WithTranslation } from 'react-i18next';
import slugify from 'slugify';
import { v4 as uuidV4 } from 'uuid';

import InputCheckbox from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import GtfsExporter from 'transition-common/lib/services/gtfs/GtfsExporter';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import { GtfsConstants, GtfsExportStatus } from 'transition-common/lib/api/gtfs';
import TransitServiceFilterableList from '../service/TransitServiceFilterableList';
import Agency from 'transition-common/lib/services/agency/Agency';
import TransitService from 'transition-common/lib/services/service/Service';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';

type GtfsExportFormState = {
    // Subset of services and agencies to display in the form, based on the selected filters
    agenciesToDisplay: Agency[];
    servicesToDisplay: TransitService[];
};

class GtfsExportForm extends ChangeEventsForm<WithTranslation, ChangeEventsState<GtfsExporter> & GtfsExportFormState> {
    constructor(props) {
        super(props);

        const uuid = uuidV4();
        const gtfsExporter = new GtfsExporter({
            selectedAgencies: [],
            selectedServices: [],
            includeTransitionCustomFields: false,
            filename: '',
            id: uuid,
            data: {},
            is_frozen: false
        });

        this.state = {
            object: gtfsExporter,
            formValues: {
                filename: gtfsExporter.get('filename', ''),
                selectedAgencies: gtfsExporter.get('selectedAgencies', []),
                selectedServices: gtfsExporter.get('selectedServices', []),
                includeTransitionCustomFields: gtfsExporter.get('includeTransitionCustomFields', false)
            },
            agenciesToDisplay: serviceLocator.collectionManager.get('agencies')?.getFeatures() ?? [],
            servicesToDisplay: serviceLocator.collectionManager.get('services')?.getFeatures() ?? []
        };
    }

    componentDidMount() {
        serviceLocator.socketEventManager.on(GtfsConstants.GTFS_EXPORT_READY, this.onPrepared);
    }

    componentWillUnmount() {
        serviceLocator.socketEventManager.off(GtfsConstants.GTFS_EXPORT_READY, this.onPrepared);
    }

    onPrepare = () => {
        const gtfsExporter = this.state.object;
        gtfsExporter.prepare();
        this.setState({
            object: gtfsExporter
        });
    };

    onPrepared = (params: GtfsExportStatus) => {
        const gtfsExporter = this.state.object;
        if (params.gtfsExporterId !== gtfsExporter.id) {
            // Not for this request, ignore
            return;
        }
        if (params.status === 'failed') {
            gtfsExporter.attributes.exportErrors = params.errors;
            return;
        }
        gtfsExporter.setData('zipFilePath', params.zipFilePath);
        gtfsExporter.setIsPrepared(true);
        this.setState({
            object: gtfsExporter
        });
    };

    private filterDataForExport(
        path: string,
        newValue: { value: any; valid?: boolean } = { value: null, valid: true }
    ) {
        const agencies = serviceLocator.collectionManager.get('agencies') as AgencyCollection | undefined;
        const services = serviceLocator.collectionManager.get('services') as ServiceCollection | undefined;
        // Collections not loaded
        if (!agencies || !services) {
            return;
        }
        if (path === 'selectedAgencies') {
            // Filter services that contain lines that are in the selected agencies
            if (Array.isArray(newValue.value) && newValue.value.length > 0) {
                // Get the line ids of the selected agencies
                const selectedLineIds =
                    newValue.value.map((agencyId) => agencies.getById(agencyId)?.getLineIds()).flat() ?? [];

                // The services to display are those that are selected, as well
                // as those that have lines for the selected agencies, to allow
                // for gradual selection of both services and agencies
                const selectedServiceIds = this.state.object.get('selectedServices', []) as string[];
                const servicesToDisplay = services
                    .getFeatures()
                    .filter(
                        (service) =>
                            selectedServiceIds.includes(service.id) ||
                            service.attributes.scheduled_lines.some((lineId) => selectedLineIds.includes(lineId))
                    );
                this.setState({
                    servicesToDisplay
                });
            } else {
                // Reset to all services if no agency is selected
                this.setState({
                    servicesToDisplay: services.getFeatures()
                });
            }
        } else if (path === 'selectedServices') {
            // Filter agencies that contain lines that are in the selected services
            if (Array.isArray(newValue.value) && newValue.value.length > 0) {
                // Get the line ids of the selected services
                const servicedLineIds =
                    newValue.value.map((serviceId) => services.getById(serviceId)?.attributes.scheduled_lines).flat() ??
                    [];
                // The agencies to display are those that are selected, as well
                // as those that have lines for the selected services, to allow
                // for gradual selection of both services and agencies
                const selectedAgencyIds = this.state.object.get('selectedAgencies', []) as string[];
                const agenciesToDisplay = agencies
                    .getFeatures()
                    .filter(
                        (agency) =>
                            selectedAgencyIds.includes(agency.id) ||
                            agency.getLineIds().some((lineId) => servicedLineIds.includes(lineId))
                    );
                this.setState({
                    agenciesToDisplay
                });
            } else {
                // Reset to all agencies if no service is selected
                this.setState({
                    agenciesToDisplay: agencies.getFeatures()
                });
            }
        }
    }

    onValueChange = (path: string, newValue: { value: any; valid?: boolean } = { value: null, valid: true }) => {
        super.onValueChange(path, newValue);

        // Filter the other list so that only the elements that match the selected ones are available for display.
        if (path === 'selectedAgencies' || path === 'selectedServices') {
            this.filterDataForExport(path, newValue);
        }
    };

    render() {
        const gtfsExporter = this.state.object;
        const exporterId = gtfsExporter.id;

        const selectedAgencies = gtfsExporter.attributes.selectedAgencies;
        const selectedServices = gtfsExporter.attributes.selectedServices;

        let agenciesChoices: { value: string; label: string }[] = [];
        const agencies = this.state.agenciesToDisplay;
        if (agencies) {
            agenciesChoices = agencies.map((agency) => ({
                value: agency.id,
                label: agency.toString()
            }));
        }

        const errors = [...(gtfsExporter.getErrors() || [])];
        const exportErrors = [...(gtfsExporter.attributes.exportErrors || [])];

        const slugifiedFileName = slugify(gtfsExporter.attributes.filename);

        return (
            <form id="tr__form-transit-gtfs-export" className="tr__form-transit-gtfs-export apptr__form">
                <h3>{this.props.t('transit:gtfs:Export')}</h3>

                <div className="tr__form-section">
                    <div className="apptr__form-input-container _two-columns">
                        <label>{this.props.t('transit:gtfs:ExportFileName')}</label>
                        <InputString
                            id={`formFieldTransitGtfsExporterFilename${exporterId}`}
                            value={gtfsExporter.attributes.filename}
                            onValueChange={(e) => this.onValueChange('filename', { value: e.target.value })}
                        />
                    </div>
                    <div className="apptr__form-input-container _two-columns">
                        <InputWrapper
                            smallInput={true}
                            label={this.props.t('transit:gtfs:IncludeTransitionCustomFields')}
                            help={this.props.t('transit:gtfs:IncludeTransitionCustomFieldsHelp')}
                        >
                            <InputCheckboxBoolean
                                id={`formFieldTransitGtfsExporterIncludeFields${exporterId}`}
                                isChecked={gtfsExporter.attributes.includeTransitionCustomFields}
                                onValueChange={(e) =>
                                    this.onValueChange('includeTransitionCustomFields', { value: e.target.value })
                                }
                            />
                        </InputWrapper>
                    </div>
                    {agenciesChoices.length > 0 && (
                        <div className="apptr__form-input-container">
                            <label className="_flex">{this.props.t('transit:gtfs:SelectedAgenciesExport')}</label>
                            <InputCheckbox
                                columns={2}
                                choices={agenciesChoices}
                                id={`formFieldTransitGtfsExporterSelectedAgencies${exporterId}`}
                                value={selectedAgencies}
                                onValueChange={(e) => this.onValueChange('selectedAgencies', { value: e.target.value })}
                                allowSelectAll={true}
                            />
                        </div>
                    )}
                    {this.state.servicesToDisplay.length > 0 && (
                        <div className="apptr__form-input-container">
                            <label className="_flex">{this.props.t('transit:transitScenario:Services')}</label>
                            <TransitServiceFilterableList
                                services={this.state.servicesToDisplay}
                                id={`formFieldTransitGtfsExporterSelectedServices${exporterId}`}
                                value={selectedServices}
                                allowSelectAll={true}
                                onValueChange={(e) => this.onValueChange('selectedServices', { value: e.target.value })}
                            />
                        </div>
                    )}
                </div>

                <FormErrors errors={errors} />
                <FormErrors errors={exportErrors} />

                {gtfsExporter.isValid && (
                    <div className="tr__form-buttons-container _right">
                        <Button
                            icon={faTasks}
                            color="green"
                            iconClass="_icon"
                            label={this.props.t('transit:gtfs:PrepareGtfsFeed')}
                            onClick={this.onPrepare}
                        />
                        {(gtfsExporter.isPrepared() as boolean) && (gtfsExporter.getData('zipFilePath') as string) && (
                            <Button
                                type="href"
                                icon={faFileDownload}
                                color="blue"
                                iconClass="_icon"
                                label={this.props.t('transit:gtfs:GtfsFeedFileDownload')}
                                href={gtfsExporter.attributes.data.zipFilePath}
                                download={`gtfs_${slugifiedFileName}.zip`}
                            />
                        )}
                    </div>
                )}
            </form>
        );
    }
}

export default withTranslation('transit')(GtfsExportForm);
