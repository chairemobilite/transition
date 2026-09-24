/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';
import { featureCollection as turfFeatureCollection } from '@turf/turf';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputText from 'chaire-lib-frontend/lib/components/input/InputText';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import InputMultiselect from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import lineModes from 'transition-common/lib/config/lineModes';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import SelectedObjectButtons from 'chaire-lib-frontend/lib/components/pageParts/SelectedObjectButtons';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import TransitServiceFilterableList from '../service/TransitServiceFilterableList';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import ScenarioLinesDetail from './TransitScenarioLinesDetail';
import { PathAttributes } from 'transition-common/lib/services/path/Path';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';
import Line from 'transition-common/lib/services/line/Line';

interface ScenarioFormProps extends WithTranslation {
    scenario: Scenario;
}

interface ScenarioFormState extends SaveableObjectState<Scenario> {
    scenarioErrors: string[];
    paths: GeoJSON.FeatureCollection<GeoJSON.LineString, PathAttributes>;
}

class TransitScenarioEdit extends SaveableObjectForm<Scenario, ScenarioFormProps, ScenarioFormState> {
    constructor(props: ScenarioFormProps) {
        super(props);

        const scenario = this.props.scenario;
        this.state = {
            object: scenario,
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            // FIXME tahini: Not using the form values here because fields may change from other places (like merging services)
            formValues: {},
            selectedObjectName: 'scenario',
            collectionName: 'scenarios',
            scenarioErrors: [],
            paths: turfFeatureCollection([])
        };
    }

    private updateTransitPathLayer = () => {
        const handleResponse = (
            status: Status.Status<GeoJSON.FeatureCollection<GeoJSON.LineString, PathAttributes>>
        ) => {
            if (Status.isStatusOk(status)) {
                const paths = Status.unwrap(status);
                (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                    layerName: 'transitPathsForServices',
                    data: paths
                });
                this.setState({ paths });
            } else {
                // There was an error in the query, reset the layer to empty feature collection
                (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                    layerName: 'transitPathsForServices',
                    data: turfFeatureCollection([])
                });
                this.setState({ paths: turfFeatureCollection([]) });
            }
        };
        if (this.props.scenario.isNew()) {
            // Get paths for the selected service if the scenario is new
            serviceLocator.socketEventManager.emit(
                'transitPaths.getForServices',
                this.props.scenario.attributes.services,
                handleResponse
            );
        } else {
            // Get paths for the current scenario
            // FIXME This does not take into account the content being edited,
            // it's for the scenario in the DB only
            serviceLocator.socketEventManager.emit(
                'transitPaths.getForScenario',
                this.props.scenario.id,
                handleResponse
            );
        }
    };

    componentDidMount() {
        this.updateTransitPathLayer();
    }

    componentWillUnmount() {
        (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
            layerName: 'transitPathsForServices',
            data: turfFeatureCollection([])
        });
    }

    protected onValueChange(path: string, newValue: { value: any; valid?: boolean } = { value: null, valid: true }) {
        super.onValueChange(path, newValue);
        if (path === 'services') {
            this.updateTransitPathLayer();
        }
    }

    render() {
        const scenario = this.state.object;
        const scenarioId = scenario.id;
        const isFrozen = scenario.isFrozen();

        const selectedServices = scenario.attributes.services;
        const onlyAgencies = scenario.attributes.only_agencies;
        const exceptAgencies = scenario.attributes.except_agencies;
        let agenciesChoices: { value: string; label: string }[] = [];
        const onlyLines = scenario.attributes.only_lines;
        const exceptLines = scenario.attributes.except_lines;
        let linesChoices: { value: string; label: string }[] = [];
        const onlyModes = scenario.attributes.only_modes;
        const exceptModes = scenario.attributes.except_modes;
        let modesChoices: { value: string; label: string }[] = [];

        const allAgencies = serviceLocator.collectionManager.get('agencies');
        agenciesChoices = allAgencies.features.map((agency) => {
            return {
                value: agency.id,
                label: agency.toString()
            };
        });

        linesChoices = serviceLocator.collectionManager.get('lines').features.map((line: Line) => {
            return {
                value: line.id,
                label: `${line.toString()} (${allAgencies.getById(line.attributes.agency_id)?.attributes.acronym})`
            };
        });

        modesChoices = lineModes.map((mode) => {
            return {
                value: mode.value,
                label: this.props.t(`transit:transitLine:modes:${mode.value}`)
            };
        });

        return (
            <form
                id={
                    scenario.isNew()
                        ? 'tr__form-transit-scenario-new'
                        : `tr__form-transit-scenario-edit__id_${scenario.get('id')}`
                }
                className="tr__form-transit-scenario-edit apptr__form"
            >
                <div className="tr__form-sticky-header-container">
                    <h3>
                        {scenario.isNew()
                            ? this.props.t('transit:transitScenario:New')
                            : this.props.t('transit:transitScenario:Edit')}
                        {scenario.toString(false) ? ` • ${scenario.toString(false)}` : ''}
                    </h3>
                    <SelectedObjectButtons
                        onDelete={this.onDelete}
                        openDeleteConfirmModal={this.openDeleteConfirmModal}
                        backAction={this.onBack}
                        openBackConfirmModal={this.openBackConfirmModal}
                        object={scenario}
                    />
                </div>
                <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                    <div className="tr__form-section">
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitScenario:Name')}</label>
                            <InputString
                                id={`formFieldTransitScenarioEditName${scenarioId}`}
                                disabled={isFrozen}
                                value={scenario.attributes.name}
                                onValueUpdated={(value) => this.onValueChange('name', value)}
                            />
                        </div>
                        {isFrozen !== true && (
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitScenario:Color')}</label>
                                <InputColor
                                    id={`formFieldTransitScenarioEditColor${scenarioId}`}
                                    value={scenario.attributes.color}
                                    onValueChange={(e) => this.onValueChange('color', { value: e.target.value })}
                                    defaultColor={Preferences.get('transit.agencies.defaultColor', '#0086FF')}
                                />
                            </div>
                        )}
                        {serviceLocator.collectionManager.get('services').length > 0 && (
                            <div className="apptr__form-input-container">
                                <label className="_flex">{this.props.t('transit:transitScenario:Services')}</label>
                                <TransitServiceFilterableList
                                    services={serviceLocator.collectionManager.get('services').features}
                                    disabled={isFrozen}
                                    id={`formFieldTransitScenarioEditServices${scenarioId}`}
                                    value={selectedServices}
                                    allowSelectAll={true}
                                    onValueChange={(e) => this.onValueChange('services', { value: e.target.value })}
                                />
                            </div>
                        )}
                        {agenciesChoices.length > 0 && (
                            <div className="apptr__form-input-container">
                                <label className="_flex">{this.props.t('transit:transitScenario:OnlyAgencies')}</label>
                                <InputMultiselect
                                    choices={agenciesChoices}
                                    t={this.props.t}
                                    disabled={isFrozen}
                                    id={`formFieldTransitScenarioEditOnlyAgencies${scenarioId}`}
                                    value={onlyAgencies}
                                    onValueChange={(e) =>
                                        this.onValueChange('only_agencies', { value: e.target.value })
                                    }
                                />
                            </div>
                        )}
                        {agenciesChoices.length > 0 && (
                            <div className="apptr__form-input-container">
                                <label className="_flex">
                                    {this.props.t('transit:transitScenario:ExceptAgencies')}
                                </label>
                                <InputMultiselect
                                    choices={agenciesChoices}
                                    t={this.props.t}
                                    disabled={isFrozen}
                                    id={`formFieldTransitScenarioEditExceptAgencies${scenarioId}`}
                                    value={exceptAgencies}
                                    onValueChange={(e) =>
                                        this.onValueChange('except_agencies', { value: e.target.value })
                                    }
                                />
                            </div>
                        )}
                        {linesChoices.length > 0 && (
                            <div className="apptr__form-input-container">
                                <label className="_flex">{this.props.t('transit:transitScenario:OnlyLines')}</label>
                                <InputMultiselect
                                    choices={linesChoices}
                                    t={this.props.t}
                                    disabled={isFrozen}
                                    id={`formFieldTransitScenarioEditOnlyLines${scenarioId}`}
                                    value={onlyLines}
                                    onValueChange={(e) => this.onValueChange('only_lines', { value: e.target.value })}
                                />
                            </div>
                        )}
                        {linesChoices.length > 0 && (
                            <div className="apptr__form-input-container">
                                <label className="_flex">{this.props.t('transit:transitScenario:ExceptLines')}</label>
                                <InputMultiselect
                                    choices={linesChoices}
                                    t={this.props.t}
                                    disabled={isFrozen}
                                    id={`formFieldTransitScenarioEditExceptLines${scenarioId}`}
                                    value={exceptLines}
                                    onValueChange={(e) => this.onValueChange('except_lines', { value: e.target.value })}
                                />
                            </div>
                        )}
                        {modesChoices.length > 0 && (
                            <div className="apptr__form-input-container">
                                <label className="_flex">{this.props.t('transit:transitScenario:OnlyModes')}</label>
                                <InputMultiselect
                                    choices={modesChoices}
                                    t={this.props.t}
                                    disabled={isFrozen}
                                    id={`formFieldTransitScenarioEditOnlyModes${scenarioId}`}
                                    value={onlyModes}
                                    onValueChange={(e) => this.onValueChange('only_modes', { value: e.target.value })}
                                />
                            </div>
                        )}
                        {modesChoices.length > 0 && (
                            <div className="apptr__form-input-container">
                                <label className="_flex">{this.props.t('transit:transitScenario:ExceptModes')}</label>
                                <InputMultiselect
                                    choices={modesChoices}
                                    t={this.props.t}
                                    disabled={isFrozen}
                                    id={`formFieldTransitScenarioEditExceptModes${scenarioId}`}
                                    value={exceptModes}
                                    onValueChange={(e) => this.onValueChange('except_modes', { value: e.target.value })}
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
                                id={`formFieldTransitScenarioEditIsFrozen${scenarioId}`}
                                label=" "
                                isChecked={isFrozen}
                                onValueChange={(e) => this.onValueChange('is_frozen', { value: e.target.value })}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitScenario:Uuid')}</label>
                            <InputString
                                disabled={true}
                                id={`formFieldTransitScenarioEditUuid${scenarioId}`}
                                value={scenarioId}
                            />
                        </div>
                        <div className="apptr__form-input-container">
                            <label>{this.props.t('transit:transitScenario:Description')}</label>
                            <InputText
                                id={`formFieldTransitScenarioEditDescription${scenarioId}`}
                                disabled={isFrozen}
                                value={scenario.attributes.description}
                                onValueChange={(e) => this.onValueChange('description', { value: e.target.value })}
                            />
                        </div>
                    </div>
                </Collapsible>

                {this.state.object.getErrors() && <FormErrors errors={this.state.object.getErrors()} />}
                {this.state.scenarioErrors && <FormErrors errors={this.state.scenarioErrors} />}
                {this.hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}

                <div>
                    {this.state.confirmModalDeleteIsOpen && (
                        <ConfirmModal
                            isOpen={true}
                            title={this.props.t('transit:transitScenario:ConfirmDelete')}
                            confirmAction={this.onDelete}
                            confirmButtonColor="red"
                            confirmButtonLabel={this.props.t('transit:transitScenario:Delete')}
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
                <div>
                    <ScenarioLinesDetail scenario={scenario} paths={this.state.paths} />
                </div>
            </form>
        );
    }
}

export default withTranslation(['transit', 'main', 'form'])(TransitScenarioEdit);
