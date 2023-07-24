/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _toString from 'lodash.tostring';
import _cloneDeep from 'lodash.clonedeep';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { PreferencesClass, default as preferences } from 'chaire-lib-common/lib/config/Preferences';
import { default as FormErrors } from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import { SaveableObjectForm, SaveableObjectState } from 'chaire-lib-frontend/lib/components/forms/SaveableObjectForm';
import { _toInteger, _toBool, _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import SelectedObjectButtons from 'chaire-lib-frontend/lib/components/pageParts/SelectedObjectButtons';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import PreferencesSectionGeneral from './sections/PreferencesSectionGeneral';
import PreferencesSectionTransitNodes from './sections/PreferencesSectionTransitNodes';
import PreferencesSectionTransitAgencies from './sections/PreferencesSectionTransitAgencies';
import PreferencesSectionTransitLines from './sections/PreferencesSectionTransitLines';
import PreferencesSectionTransitPaths from './sections/PreferencesSectionTransitPaths';
import PreferencesSectionTransitServices from './sections/PreferencesSectionTransitServices';
import PreferencesSectionTransitScenarios from './sections/PreferencesSectionTransitScenarios';
import PreferencesSectionFeatures from './sections/PreferencesSectionFeatures';

type PreferencesPanelProps = WithTranslation;

type PreferencesFormState = SaveableObjectState<PreferencesClass>;

class PreferencesPanel extends SaveableObjectForm<PreferencesClass, PreferencesPanelProps, PreferencesFormState> {
    private resetChangesCount = 0;

    constructor(props: PreferencesPanelProps) {
        super(props);

        preferences.startEditing();
        serviceLocator.selectedObjectsManager.select('preferences', preferences);

        this.state = {
            object: preferences,
            formValues: {},
            confirmModalDeleteIsOpen: false,
            confirmModalBackIsOpen: false,
            selectedObjectName: 'preferences'
        };

        this.onDeselect = this.onDeselect.bind(this);
        this.resetPrefToDefault = this.resetPrefToDefault.bind(this);
    }

    protected onHistoryChange = () => {
        this.resetChangesCount++;
        const stateObject = this.state.object;
        this.setState({
            object: stateObject
        });
    };

    // TODO: navigate to previous section or default if no previous (we need to implement a navigation history)

    componentDidMount() {
        serviceLocator.eventManager.on('selected.deselect.preferences', this.onDeselect);
    }

    componentWillUnmount() {
        serviceLocator.eventManager.off('selected.deselect.preferences', this.onDeselect);
    }

    onDeselect() {
        serviceLocator.eventManager.emit('section.change', preferences.getAttributes().defaultSection);
    }

    resetPrefToDefault(path) {
        this.state.object.resetPathToDefault(path);
        this.resetChangesCount++;
        serviceLocator.selectedObjectsManager.update(this.state.selectedObjectName, this.state.object);
        const stateObject = this.state.object;
        this.setState({
            object: stateObject
        });
    }

    render() {
        const prefs = this.state.object.getAttributes();
        const errors = this.state.object.getErrors() || [];

        return (
            <form id="tr__form-preferences" className="tr__form-preferences apptr__form">
                <h3>{this.props.t('main:Preferences')}</h3>

                <PreferencesSectionGeneral
                    preferences={this.state.object}
                    onValueChange={this.onValueChange}
                    resetChangesCount={this.resetChangesCount}
                    resetPrefToDefault={this.resetPrefToDefault}
                />

                <PreferencesSectionTransitNodes
                    preferences={this.state.object}
                    onValueChange={this.onValueChange}
                    resetChangesCount={this.resetChangesCount}
                    resetPrefToDefault={this.resetPrefToDefault}
                />

                <PreferencesSectionTransitAgencies
                    preferences={this.state.object}
                    onValueChange={this.onValueChange}
                    resetChangesCount={this.resetChangesCount}
                    resetPrefToDefault={this.resetPrefToDefault}
                />

                <PreferencesSectionTransitLines
                    preferences={this.state.object}
                    onValueChange={this.onValueChange}
                    resetChangesCount={this.resetChangesCount}
                    resetPrefToDefault={this.resetPrefToDefault}
                />

                <PreferencesSectionTransitPaths
                    preferences={this.state.object}
                    onValueChange={this.onValueChange}
                    resetChangesCount={this.resetChangesCount}
                    resetPrefToDefault={this.resetPrefToDefault}
                />

                <PreferencesSectionTransitServices
                    preferences={this.state.object}
                    onValueChange={this.onValueChange}
                    resetChangesCount={this.resetChangesCount}
                    resetPrefToDefault={this.resetPrefToDefault}
                />

                <PreferencesSectionTransitScenarios
                    preferences={this.state.object}
                    onValueChange={this.onValueChange}
                    resetChangesCount={this.resetChangesCount}
                    resetPrefToDefault={this.resetPrefToDefault}
                />

                <PreferencesSectionFeatures
                    preferences={this.state.object}
                    onValueChange={this.onValueChange}
                    resetChangesCount={this.resetChangesCount}
                    resetPrefToDefault={this.resetPrefToDefault}
                />

                {errors.length > 0 && <FormErrors errors={errors} />}
                {this.hasInvalidFields() && <FormErrors errors={['main:errors:InvalidFormFields']} />}

                <div>
                    <SelectedObjectButtons
                        backAction={this.onBack}
                        openBackConfirmModal={this.openBackConfirmModal}
                        object={this.state.object}
                        hideDelete={true}
                        onUndo={this.onHistoryChange}
                        onRedo={this.onHistoryChange}
                    />
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

export default withTranslation(['transit', 'main', 'form'])(PreferencesPanel);
