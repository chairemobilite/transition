/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';
import { faFileDownload } from '@fortawesome/free-solid-svg-icons/faFileDownload';
import { faTasks } from '@fortawesome/free-solid-svg-icons/faTasks';
import _get from 'lodash/get';
import { withTranslation, WithTranslation } from 'react-i18next';
import slugify from 'slugify';
import { v4 as uuidV4 } from 'uuid';

import InputCheckbox from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import GtfsExporter from 'transition-common/lib/services/gtfs/GtfsExporter';
import { ChangeEventsForm, ChangeEventsState } from 'chaire-lib-frontend/lib/components/forms/ChangeEventsForm';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GtfsConstants, GtfsExportStatus } from 'transition-common/lib/api/gtfs';

class GtfsExportForm extends ChangeEventsForm<WithTranslation, ChangeEventsState<GtfsExporter>> {
    constructor(props) {
        super(props);

        const uuid = uuidV4();
        const gtfsExporter = new GtfsExporter({
            selectedAgencies: [],
            filename: '',
            id: uuid,
            data: {},
            is_frozen: false
        });

        this.state = {
            object: gtfsExporter,
            formValues: {
                filename: gtfsExporter.get('filename', ''),
                selectedAgencies: gtfsExporter.get('selectedAgencies', [])
            }
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

    render() {
        const gtfsExporter = this.state.object;
        const exporterId = gtfsExporter.id;

        const selectedAgencies = gtfsExporter.attributes.selectedAgencies;

        let agenciesChoices = [];
        const agencies = serviceLocator.collectionManager.get('agencies')?.getFeatures();
        if (agencies) {
            agenciesChoices = agencies.map((agency) => ({
                value: agency.get('id'),
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
