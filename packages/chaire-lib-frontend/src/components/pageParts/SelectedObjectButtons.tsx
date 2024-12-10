/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowLeft';
import { faUndoAlt } from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import { faRedoAlt } from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons/faTrashAlt';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons/faCheckCircle';

import Button from '../input/Button';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import { Saveable, isSaveable } from 'chaire-lib-common/lib/utils/objects/Saveable';

export type SelectedObjectButtonsProps<T extends ObjectWithHistory<any>> = WithTranslation & {
    object: T;
    /**
     * Function called when the save button is clicked. It replaces the default
     * save action, which validates the object and calls the save method on it
     * if there was changes. It also deselects the current object
     */
    saveAction?: React.MouseEventHandler;
    /**
     * Function called after the object has been saved with the default save
     * function. If saveAction is set, then this will have no effect
     */
    afterSave?: (param: any) => void;
    /**
     * Function called after the undo button was clicked and the last action was
     * undone
     */
    onUndo?: (object: T) => void;
    /**
     * Function called after the redo button was clicked and the last action was
     * redone
     */
    onRedo?: (object: T) => void;
    /**
     * Whether to hide or show the delete button
     */
    hideDelete?: boolean;
    /**
     * Whether to hide or show the save button (useful when errors are detected in forms)
     */
    hideSave?: boolean;
    /**
     * Function called when the delete button is clicked and the object is new,
     * otherwise, it is the openDeleteConfirmModal that is called
     */
    deleteAction?: React.MouseEventHandler;
    // @deprecated Use deleteAction instead, for coherence with saveAction
    onDelete?: React.MouseEventHandler;
    // TODO Should this be part of the onDelete on the caller? The code uses it
    // only when the object already exists. Should this become a stateful
    // component and take care of the delete confirm modal?
    openDeleteConfirmModal?: React.MouseEventHandler;

    backAction?: React.MouseEventHandler;
    openBackConfirmModal?: React.MouseEventHandler;
};

const SelectedObjectButtons: React.FunctionComponent<SelectedObjectButtonsProps<any>> = <
    T extends ObjectWithHistory<any>
>(
        props: SelectedObjectButtonsProps<T>
    ) => {
    const object = props.object;
    const objectSingularName = object.getSingularName();
    const objectPluralName = object.getPluralName();
    const objectCapitalizedSingularName = object.getCapitalizedSingularName();
    const isFrozen = object.getAttributes().is_frozen;
    // That may not be the role of this widget to deal with this manager
    const selectObjectManager = serviceLocator.selectedObjectsManager;
    const deleteAction = props.deleteAction ? props.deleteAction : props.onDelete;
    const saveAction = props.saveAction
        ? props.saveAction
        : function () {
            if (!isSaveable(object)) {
                console.error(
                    'The object to save is not saveable. The default save will not work on them. You may specify a saveAction props to customize how to save the object'
                );
                return;
            }
            if (isFrozen === true && object.wasFrozen()) {
                serviceLocator.selectedObjectsManager.deselect(objectSingularName);
                return true;
            }
            if (object.validate()) {
                if (object.hasChanged()) {
                    serviceLocator.eventManager.emit('progress', {
                        name: `Saving${objectCapitalizedSingularName}`,
                        progress: 0.0
                    });
                    object
                        .save(serviceLocator.socketEventManager)
                        .then((response) => {
                            if (props.afterSave) {
                                props.afterSave(response);
                            }
                            serviceLocator.selectedObjectsManager.deselect(objectSingularName);
                            serviceLocator.collectionManager.refresh(objectPluralName);
                            serviceLocator.eventManager.emit('progress', {
                                name: `Saving${objectCapitalizedSingularName}`,
                                progress: 1.0
                            });
                        })
                        .catch((error) => {
                            console.error(error); // todo: better error handling
                        });
                } else {
                    if (selectObjectManager) serviceLocator.selectedObjectsManager.deselect(objectSingularName);
                }
            } else {
                if (selectObjectManager) serviceLocator.selectedObjectsManager.update(objectSingularName, object);
            }
        };

    const undoClick = () => {
        object.undo();
        if (props.onUndo) {
            props.onUndo(object);
        }
        if (selectObjectManager) serviceLocator.selectedObjectsManager.update(objectSingularName, object);
    };

    const redoClick = () => {
        object.redo();
        if (props.onRedo) {
            props.onRedo(object);
        }
        if (selectObjectManager) serviceLocator.selectedObjectsManager.update(objectSingularName, object);
    };

    return (
        <div className="tr__form-buttons-container tr__form-selected-object-buttons-container">
            <Button
                title={props.t('main:Back')}
                name="back"
                key="back"
                color="blue"
                icon={faArrowLeft}
                iconClass="_icon-alone"
                label=""
                onClick={object.hasChanged() ? props.openBackConfirmModal : props.backAction}
            />
            {isFrozen !== true && (
                <Button
                    title={props.t('main:Undo')}
                    name="undo"
                    key="undo"
                    color="grey"
                    disabled={!object.canUndo()}
                    icon={faUndoAlt}
                    iconClass="_icon-alone"
                    label=""
                    onClick={undoClick}
                />
            )}
            {isFrozen !== true && (
                <Button
                    title={props.t('main:Redo')}
                    name="redo"
                    key="redo"
                    color="grey"
                    disabled={!object.canRedo()}
                    icon={faRedoAlt}
                    iconClass="_icon-alone"
                    label=""
                    onClick={redoClick}
                />
            )}
            {props.hideSave !== true && (
                <Button
                    title={props.t('main:Save')}
                    name="save"
                    key="save"
                    icon={faCheckCircle}
                    iconClass="_icon-alone"
                    label=""
                    onClick={saveAction}
                />
            )}
            {isFrozen !== true && props.hideDelete !== true && (
                <Button
                    title={props.t('main:Delete')}
                    name="delete"
                    key="delete"
                    color="red"
                    icon={faTrashAlt}
                    iconClass="_icon-alone"
                    label=""
                    onClick={object.isNew() ? deleteAction : props.openDeleteConfirmModal}
                />
            )}
        </div>
    );
};

export default withTranslation(['main', 'notifications'])(SelectedObjectButtons);
