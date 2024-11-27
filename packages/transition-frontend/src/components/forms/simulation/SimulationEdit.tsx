/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputText from 'chaire-lib-frontend/lib/components/input/InputText';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import Simulation from 'transition-common/lib/services/simulation/Simulation';
import SimulationCollection from 'transition-common/lib/services/simulation/SimulationCollection';
import BaseSimulationComponent from './widgets/BaseSimulationComponent';
import SelectedObjectButtons from 'chaire-lib-frontend/lib/components/pageParts/SelectedObjectButtons';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import TransitRoutingBaseComponent from '../transitRouting/widgets/TransitRoutingBaseComponent';
import SimulationParametersComponent from './widgets/SimulationParametersComponent';
import AlgorithmComponent from './widgets/SimulationAlgorithmComponent';
import SimulationRunList from './widgets/SimulationRunList';

interface SimulationFormProps extends WithTranslation {
    simulation: Simulation;
    simulationCollection: SimulationCollection;
}

interface SimulationFormState extends SaveableObjectState<Simulation> {
    resetChangesCount: number;
}

class SimulationEdit extends SaveableObjectForm<Simulation, SimulationFormProps, SimulationFormState> {
    constructor(props: SimulationFormProps) {
        super(props);

        this.state = {
            object: this.props.simulation,
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            // FIXME tahini: Not using the form values here because fields may change from other places (like merging services)
            formValues: {},
            selectedObjectName: 'simulation',
            collectionName: 'simulations',
            resetChangesCount: 0
        };
    }

    protected onHistoryChange = () => {
        this.setState({
            resetChangesCount: this.state.resetChangesCount + 1
        });
    };

    render() {
        const simulation = this.state.object;
        const isFrozen = simulation.isFrozen();
        const simulationId = simulation.id;
        const isNew = simulation.isNew();

        return (
            <form
                id={isNew ? 'tr__form-transit-simulation-new' : `tr__form-transit-simulation-edit__id_${simulationId}`}
                className="tr__form-transit-simulation-edit apptr__form"
            >
                <div className="tr__form-sticky-header-container">
                    <h3>
                        {simulation.getData('isNew')
                            ? this.props.t('transit:simulation:New')
                            : this.props.t('transit:simulation:Edit')}
                        {simulation.toString(false) ? ` • ${simulation.toString(false)}` : ''}
                    </h3>
                    <SelectedObjectButtons
                        deleteAction={this.onDelete}
                        openDeleteConfirmModal={this.openDeleteConfirmModal}
                        backAction={this.onBack}
                        openBackConfirmModal={this.openBackConfirmModal}
                        object={simulation}
                        onUndo={this.onHistoryChange}
                        onRedo={this.onHistoryChange}
                    />
                </div>
                <Collapsible trigger={this.props.t('form:basicFields')} open={true} transitionTime={100}>
                    <div className="tr__form-section">
                        <BaseSimulationComponent
                            key={`simulation${this.state.resetChangesCount}`}
                            attributes={simulation.attributes}
                            disabled={isFrozen}
                            onValueChange={this.onValueChange}
                        />
                    </div>
                    <h4>{this.props.t('transit:simulation:simulationParameters')}</h4>
                    <div className="tr__form-section">
                        <SimulationParametersComponent
                            key={`simulation${this.state.resetChangesCount}`}
                            disabled={isFrozen}
                            onValueChange={(path, value) =>
                                this.onValueChange(`data.simulationParameters.${path}`, value)
                            }
                            attributes={simulation.attributes.data.simulationParameters}
                        />
                    </div>
                    <h4>{this.props.t('transit:simulation:algorithmParameters')}</h4>
                    <div className="tr__form-section">
                        <AlgorithmComponent
                            key={`algorithm${this.state.resetChangesCount}`}
                            disabled={isFrozen}
                            onValueChange={(path, value) =>
                                this.onValueChange(`data.algorithmConfiguration.${path}`, value)
                            }
                            algorithmConfig={simulation.attributes.data.algorithmConfiguration}
                            simulation={simulation}
                        />
                    </div>
                    <h4>{this.props.t('transit:simulation:routingParameters')}</h4>
                    <div className="tr__form-section">
                        <TransitRoutingBaseComponent
                            key={`simulation${this.state.resetChangesCount}`}
                            disabled={isFrozen}
                            onValueChange={(path, value) => this.onValueChange(`data.routingAttributes.${path}`, value)}
                            attributes={simulation.attributes.data.routingAttributes}
                        />
                    </div>
                </Collapsible>

                <Collapsible trigger={this.props.t('form:advancedFields')} transitionTime={100}>
                    <div className="tr__form-section">
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('main:Locked')}</label>
                            <InputCheckboxBoolean
                                id={`formFieldTransitSimulationEditIsFrozen${simulationId}`}
                                label=" "
                                isChecked={isFrozen}
                                onValueChange={(e) => this.onValueChange('is_frozen', { value: e.target.value })}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:simulation:Uuid')}</label>
                            <InputString
                                disabled={true}
                                id={`formFieldTransitSimulationEditUuid${simulationId}`}
                                value={simulationId}
                            />
                        </div>
                        <div className="apptr__form-input-container _two-columns">
                            <label>{this.props.t('transit:simulation:InternalId')}</label>
                            <InputString
                                id={`formFieldSimulationEditInternalId${simulationId}`}
                                disabled={isFrozen}
                                value={simulation.attributes.internal_id}
                                onValueUpdated={(value) => this.onValueChange('internal_id', value)}
                            />
                        </div>
                        <div className="apptr__form-input-container">
                            <label>{this.props.t('transit:simulation:Description')}</label>
                            <InputText
                                id={`formFieldTransitSimulationEditDescription${simulationId}`}
                                disabled={isFrozen}
                                value={simulation.getAttributes().description}
                                onValueChange={(e) => this.onValueChange('description', { value: e.target.value })}
                            />
                        </div>
                    </div>
                </Collapsible>

                <Collapsible trigger={this.props.t('transit:simulation:SimulationRuns')} transitionTime={100}>
                    <SimulationRunList simulation={this.props.simulation} />
                </Collapsible>

                {this.state.object.getErrors() && <FormErrors errors={this.state.object.getErrors()} />}
                {this.hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}

                <div>
                    {this.state.confirmModalDeleteIsOpen && (
                        <ConfirmModal
                            isOpen={true}
                            title={this.props.t('transit:simulation:ConfirmDelete')}
                            confirmAction={this.onDelete}
                            confirmButtonColor="red"
                            confirmButtonLabel={this.props.t('transit:simulation:Delete')}
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
        );
    }
}

export default withTranslation(['transit', 'main', 'form'])(SimulationEdit);
