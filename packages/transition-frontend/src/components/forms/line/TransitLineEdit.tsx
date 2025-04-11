/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import Collapsible from 'react-collapsible';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputText from 'chaire-lib-frontend/lib/components/input/InputText';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputRadio from 'chaire-lib-frontend/lib/components/input/InputRadio';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { getAutocompleteListFromObjectCollection } from 'chaire-lib-frontend/lib/services/autoCompleteNextService';
import lineModes from 'transition-common/lib/config/lineModes';
import { lineCategoriesArray } from 'transition-common/lib/config/lineCategories';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import Path from 'transition-common/lib/services/path/Path';
import Line from 'transition-common/lib/services/line/Line';
import TransitPathsList from '../path/TransitPathList';
import TransitPathEdit from '../path/TransitPathEdit';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import SelectedObjectButtons from 'chaire-lib-frontend/lib/components/pageParts/SelectedObjectButtons';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { MapUpdateLayerEventType } from 'chaire-lib-frontend/lib/services/map/events/MapEventsCallbacks';

interface LineFormProps extends WithTranslation {
    line: Line;
    availableRoutingModes: string[];
    agencyCollection: AgencyCollection;
    selectedSchedule: boolean;
    selectedPath?: Path;
}

interface LineFormState extends SaveableObjectState<Line> {
    lineErrors: string[];
    lineNumberAutocompleteChoices: string[];
}

const lineCategories = lineCategoriesArray.map((cat) => ({ value: cat }));

class TransitLineEdit extends SaveableObjectForm<Line, LineFormProps, LineFormState> {
    constructor(props: LineFormProps) {
        super(props);

        this.state = {
            object: props.line,
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            // FIXME tahini: Not using the form values here because fields may change from other places (like merging services)
            formValues: {},
            selectedObjectName: 'line',
            collectionName: 'lines',
            lineErrors: [],
            lineNumberAutocompleteChoices: []
        };
    }

    componentDidMount() {
        this.updateAutocompleteListForShortname();
    }

    onDelete = async (e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }

        const line = this.props.line;
        const lineHasPaths = line.hasPaths();

        if (line.isNew()) {
            serviceLocator.selectedObjectsManager.deselect('line');
        } else {
            serviceLocator.eventManager.emit('progress', { name: 'DeletingLine', progress: 0.0 });
            await line.delete(serviceLocator.socketEventManager);
            if (lineHasPaths) {
                // reload paths
                serviceLocator.selectedObjectsManager.deselect('line');
                await serviceLocator.collectionManager.get('paths').loadFromServer(serviceLocator.socketEventManager);
                serviceLocator.collectionManager.refresh('paths');
                (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                    layerName: 'transitPaths',
                    data: serviceLocator.collectionManager.get('paths').toGeojsonSimplified()
                });
                serviceLocator.collectionManager.refresh('lines');
                serviceLocator.eventManager.emit('progress', { name: 'DeletingLine', progress: 1.0 });
            } else {
                serviceLocator.selectedObjectsManager.deselect('line');
                serviceLocator.eventManager.emit('progress', { name: 'DeletingLine', progress: 1.0 });
                serviceLocator.collectionManager.refresh('lines');
            }
        }
    };

    onSave = async () => {
        const line = this.props.line;
        const isFrozen = line.isFrozen();

        if (isFrozen === true && line.wasFrozen()) {
            serviceLocator.selectedObjectsManager.deselect('line');
            return true;
        }
        line.validate();
        if (!line.isValid) {
            serviceLocator.selectedObjectsManager.setSelection('line', [line]);
            return false;
        }

        if (!line.hasChanged()) {
            serviceLocator.selectedObjectsManager.deselect('line');
            return true;
        }
        const wasNew = line.isNew();
        serviceLocator.eventManager.emit('progress', { name: 'SavingLine', progress: 0.0 });
        try {
            const agencyChanged = line.hasChanged('agency_id');
            await line.save(serviceLocator.socketEventManager);
            // we need to update agencies collection if agency_id changed
            if (agencyChanged) {
                // TODO Just reload all from server
                await serviceLocator.collectionManager
                    .get('agencies')
                    .loadFromServer(serviceLocator.socketEventManager);
            }
            if (!wasNew) {
                serviceLocator.selectedObjectsManager.deselect('line');
            } else {
                serviceLocator.selectedObjectsManager.setSelection('line', [line]);
            }
            serviceLocator.collectionManager.refresh('lines');
            serviceLocator.collectionManager.refresh('agencies');
            serviceLocator.collectionManager.refresh('paths');
            (serviceLocator.eventManager as EventManager).emitEvent<MapUpdateLayerEventType>('map.updateLayer', {
                layerName: 'transitPaths',
                data: serviceLocator.collectionManager.get('paths').toGeojsonSimplified()
            });
            serviceLocator.eventManager.emit('progress', { name: 'SavingLine', progress: 1.0 });
            serviceLocator.eventManager.emit('fullSizePanel.hide');
        } catch (error) {
            console.error(error); // todo: better error handling
        }
    };

    shortNameUpdated() {
        this.updateAutocompleteListForShortname();
    }

    async updateAutocompleteListForShortname() {
        if (!this.props.line.isNew()) {
            return [];
        }
        const agencyFeature = this.props.agencyCollection.getById(this.props.line.attributes.agency_id);
        if (!agencyFeature) {
            return [];
        }
        const lines: Line[] = [];
        serviceLocator.collectionManager
            .get('lines')
            .getFeatures()
            .forEach((lineFeature) => {
                if (lineFeature.get('agency_id') === this.props.line.get('agency_id')) {
                    lines.push(lineFeature);
                }
            });

        const autocompleteList = await getAutocompleteListFromObjectCollection(
            lines,
            'shortname',
            this.props.line.attributes.shortname
        );
        this.setState({ lineNumberAutocompleteChoices: autocompleteList });
    }

    render() {
        const line = this.props.line;
        const completePaths = line.getCompletePaths();
        const lineId = line.id;
        const isFrozen = line.isFrozen();
        line.refreshPaths();
        const lineHasSchedules = Object.keys(line.getSchedules()).length > 0;

        const agencies = this.props.agencyCollection.getFeatures();
        const agenciesChoices: { value: string; label: string }[] = [];

        for (let i = 0, count = agencies.length; i < count; i++) {
            const agencyFeature = agencies[i];
            agenciesChoices.push({
                value: agencyFeature.id,
                label: agencyFeature.toString(false)
            });
        }

        const canCreateNewPath =
            !this.props.selectedSchedule &&
            (!this.props.selectedPath || (this.props.selectedPath && !this.props.selectedPath.hasChanged()));
        const canActionButtons = canCreateNewPath;

        return (
            <form
                id={line.isNew() ? 'tr__form-transit-line-new' : `tr__form-transit-line-edit__id_${line.get('id')}`}
                className="tr__form-transit-line-edit apptr__form"
            >
                <div className="tr__form-sticky-header-container">
                    <h3>
                        <img
                            src={'/dist/images/icons/transit/line_white.svg'}
                            className="_icon"
                            alt={this.props.t('transit:transitLine:Line')}
                        />{' '}
                        {line.isNew()
                            ? this.props.t('transit:transitLine:New')
                            : this.props.t('transit:transitLine:Edit')}
                        {line.toString(false) ? ` • ${line.toString(false)}` : ''}
                    </h3>
                    {!this.props.selectedPath && canActionButtons && (
                        <SelectedObjectButtons
                            onDelete={this.onDelete}
                            openDeleteConfirmModal={this.openDeleteConfirmModal}
                            object={line}
                            backAction={(e) => {
                                this.onBack(e);
                                serviceLocator.eventManager.emit('fullSizePanel.hide');
                            }}
                            openBackConfirmModal={this.openBackConfirmModal}
                            saveAction={this.onSave}
                        />
                    )}
                </div>
                <Collapsible
                    trigger={this.props.t('form:basicFields')}
                    open={_isBlank(this.props.selectedPath)}
                    transitionTime={100}
                >
                    <div className="tr__form-section">
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:Agency')}</label>
                            <InputSelect
                                id={`formFieldTransitLineEditAgency${lineId}`}
                                disabled={isFrozen}
                                value={line.attributes.agency_id}
                                choices={agenciesChoices}
                                t={this.props.t}
                                onValueChange={(e) => this.onValueChange('agency_id', { value: e.target.value })}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:Shortname')}</label>
                            <InputString
                                id={`formFieldTransitLineEditShortname${lineId}`}
                                disabled={isFrozen}
                                value={line.attributes.shortname}
                                onValueUpdated={(value) => {
                                    this.onValueChange('shortname', value);
                                    this.shortNameUpdated();
                                }}
                                autocompleteChoices={this.state.lineNumberAutocompleteChoices}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:Longname')}</label>
                            <InputString
                                id={`formFieldTransitLineEditLongname${lineId}`}
                                disabled={isFrozen}
                                value={line.attributes.longname}
                                onValueUpdated={(value) => this.onValueChange('longname', value)}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:Mode')}</label>
                            <InputSelect
                                id={`formFieldTransitLineEditMode${lineId}`}
                                disabled={isFrozen}
                                value={line.attributes.mode}
                                choices={lineModes}
                                localePrefix="transit:transitLine:modes"
                                t={this.props.t}
                                onValueChange={(e) => this.onValueChange('mode', { value: e.target.value })}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:Category')}</label>
                            <InputSelect
                                id={`formFieldTransitLineEditCategory${lineId}`}
                                disabled={isFrozen}
                                value={line.attributes.category || ''}
                                choices={lineCategories}
                                localePrefix="transit:transitLine:categories"
                                t={this.props.t}
                                onValueChange={(e) => this.onValueChange('category', { value: e.target.value })}
                            />
                        </div>
                        {isFrozen !== true && (
                            <div className="apptr__form-input-container _two-columns">
                                <label>{this.props.t('transit:transitLine:Color')}</label>
                                <InputColor
                                    id={`formFieldTransitLineEditColor${lineId}`}
                                    value={line.attributes.color}
                                    defaultColor={Preferences.attributes.transit.lines.defaultColor}
                                    onValueChange={(e) => this.onValueChange('color', { value: e.target.value })}
                                />
                            </div>
                        )}
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:IsAutonomous')}</label>
                            <InputRadio
                                id={`formFieldTransitLineEditIsAutonomous${lineId}`}
                                value={line.attributes.is_autonomous}
                                sameLine={true}
                                disabled={isFrozen}
                                choices={[{ value: true }, { value: false }]}
                                localePrefix="transit:transitLine"
                                t={this.props.t}
                                isBoolean={true}
                                onValueChange={(e) => this.onValueChange('is_autonomous', { value: e.target.value })}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:AllowSameLineTransfers')}</label>
                            <InputRadio
                                id={`formFieldTransitLineEditAllowSameLineTransfers${lineId}`}
                                value={line.attributes.allow_same_line_transfers}
                                sameLine={true}
                                disabled={isFrozen}
                                choices={[{ value: true }, { value: false }]}
                                localePrefix="transit:transitLine"
                                t={this.props.t}
                                isBoolean={true}
                                onValueChange={(e) =>
                                    this.onValueChange('allow_same_line_transfers', { value: e.target.value })
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
                                id={`formFieldTransitLineEditIsFrozen${lineId}`}
                                label=" "
                                isChecked={isFrozen}
                                onValueChange={(e) => this.onValueChange('is_frozen', { value: e.target.value })}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:Uuid')}</label>
                            <InputString disabled={true} id={`formFieldTransitLineEditUuid${lineId}`} value={lineId} />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:transitLine:InternalId')}</label>
                            <InputString
                                id={`formFieldTransitLineEditInternalId${lineId}`}
                                value={line.attributes.internal_id}
                                disabled={isFrozen}
                                onValueUpdated={(value) => this.onValueChange('internal_id', value)}
                            />
                        </div>
                        <div className="apptr__form-input-container">
                            <label>{this.props.t('transit:transitLine:Description')}</label>
                            <InputText
                                id={`formFieldTransitLineEditDescription${lineId}`}
                                value={line.attributes.description}
                                disabled={isFrozen}
                                onValueChange={(e) => this.onValueChange('description', { value: e.target.value })}
                            />
                        </div>
                    </div>
                </Collapsible>

                <FormErrors errors={line.errors} />

                {canActionButtons && (
                    <div>
                        {!this.props.selectedPath &&
                            !this.props.selectedSchedule &&
                            (completePaths.length > 0 || lineHasSchedules) && (
                            <div className="tr__form-buttons-container">
                                <Button
                                    color="blue"
                                    iconPath={'/dist/images/icons/transit/schedule_white.svg'}
                                    iconClass="_icon"
                                    label={this.props.t('transit:transitSchedule:Schedules')}
                                    onClick={function () {
                                        serviceLocator.eventManager.emit('fullSizePanel.show');
                                    }.bind(this)}
                                />
                            </div>
                        )}
                        {this.state.confirmModalDeleteIsOpen && (
                            <ConfirmModal
                                isOpen={true}
                                title={this.props.t('transit:transitLine:ConfirmDelete')}
                                confirmAction={this.onDelete}
                                confirmButtonColor="red"
                                confirmButtonLabel={this.props.t('transit:transitLine:Delete')}
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
                )}

                {!line.isNew() && (
                    <TransitPathsList
                        paths={line.paths}
                        line={line}
                        selectedPath={this.props.selectedPath}
                        selectedSchedule={!!this.props.selectedSchedule}
                    />
                )}

                {!line.isNew() &&
                    isFrozen !== true &&
                    canCreateNewPath && ( // new path
                    <div className="tr__form-buttons-container">
                        <Button
                            color="blue"
                            icon={faPlus}
                            iconClass="_icon"
                            label={this.props.t('transit:transitLine:NewTransitPath')}
                            onClick={() => {
                                // new path

                                if (this.props.selectedPath) {
                                    serviceLocator.selectedObjectsManager.deselect('path');
                                }

                                const newTransitPath = line.newPath();
                                newTransitPath.startEditing();
                                serviceLocator.eventManager.emit('map.disableBoxZoom');
                                serviceLocator.selectedObjectsManager.setSelection('path', [newTransitPath]);
                                serviceLocator.eventManager.emit('selected.updateLayers.path');
                            }}
                        />
                    </div>
                )}

                {!line.isNew() && this.props.selectedPath && (
                    <TransitPathEdit
                        path={this.props.selectedPath}
                        availableRoutingModes={this.props.availableRoutingModes}
                        line={line}
                    />
                )}
            </form>
        );
    }
}

export default withTranslation(['transit', 'form', 'main', 'notifications'])(TransitLineEdit);
