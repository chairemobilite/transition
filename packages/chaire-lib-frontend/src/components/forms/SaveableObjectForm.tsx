/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { Saveable } from 'chaire-lib-common/lib/utils/objects/Saveable';
import { ChangeEventsForm, ChangeEventsState } from './ChangeEventsForm';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';

export interface SaveableObjectState<T extends GenericObject<any> & Saveable> extends ChangeEventsState<T> {
    // TODO Figure out where the responsability for the delete modal is: now this and the implementation form need to know AND the selected object buttons as well. Responsibility is too shared...
    confirmModalDeleteIsOpen: boolean;
    confirmModalBackIsOpen: boolean;
    /**
     * Name of the object in the applicaiton wide selection
     *
     * TODO Should some other class deal with selection and this one just use callbacks?
     */
    selectedObjectName: string;
    collectionName?: string;
}

export abstract class SaveableObjectForm<
    T extends GenericObject<any> & Saveable,
    P,
    S extends SaveableObjectState<T>
> extends ChangeEventsForm<P, S> {
    constructor(props: P) {
        super(props);

        this.onValueChange = this.onValueChange.bind(this);
        this.onFormFieldChange = this.onFormFieldChange.bind(this);
        this.onDelete = this.onDelete.bind(this);
        this.onBack = this.onBack.bind(this);
    }

    protected onValueChange(path: string, newValue: { value: any; valid?: boolean } = { value: null, valid: true }) {
        super.onValueChange(path, newValue);
        if (newValue.valid || newValue.valid === undefined) {
            if (this.state.object.isNew()) {
                serviceLocator.selectedObjectsManager.update(this.state.selectedObjectName, this.state.object);
            } else {
                serviceLocator.selectedObjectsManager.updateAndValidate(
                    this.state.selectedObjectName,
                    this.state.object
                );
            }
        }
    }

    protected async onDelete(e: any): Promise<void> {
        // TODO Deleting objects shouldn't be done by a form, this should be a one-liner to some function that will take care of everything happening here.
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }

        const object = this.state.object;
        const capitalizedSingularName = object.getCapitalizedSingularName();
        const progressName = `Deleting${capitalizedSingularName}`;
        const singularName = object.getSingularName();

        if (object.isNew()) {
            serviceLocator.selectedObjectsManager.deselect(singularName);
        } else {
            const selectedObject = serviceLocator.selectedObjectsManager.get(singularName);
            serviceLocator.eventManager.emit('progress', { name: progressName, progress: 0.0 });

            await object.delete(serviceLocator.socketEventManager);

            if (selectedObject && selectedObject.get('id') === object.get('id')) {
                serviceLocator.selectedObjectsManager.deselect(singularName);
            }
            if (this.state.collectionName && serviceLocator.collectionManager.has(this.state.collectionName)) {
                serviceLocator.collectionManager.refresh(this.state.collectionName);
            }
            serviceLocator.eventManager.emit('progress', { name: progressName, progress: 1.0 });
        }
    }

    protected openDeleteConfirmModal = (e: any) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        this.setState({
            confirmModalDeleteIsOpen: true
        });
    };

    protected closeDeleteConfirmModal = (e: any) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        this.setState({
            confirmModalDeleteIsOpen: false
        });
    };

    protected async onBack(e: any): Promise<void> {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        const object = this.state.object;

        if (ObjectWithHistory.isObjectWithHistory(object)) {
            if (object.hasChanged()) {
                object.cancelEditing();
            }
        }
        const singularName = object.getSingularName();

        serviceLocator.selectedObjectsManager.deselect(singularName);
    }

    protected openBackConfirmModal = (e: any) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        this.setState({
            confirmModalBackIsOpen: true
        });
    };

    protected closeBackConfirmModal = (e: any) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        this.setState({
            confirmModalBackIsOpen: false
        });
    };
}

export default ChangeEventsForm;
