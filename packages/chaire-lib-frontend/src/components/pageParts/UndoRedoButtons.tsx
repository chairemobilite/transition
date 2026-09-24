/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { faUndoAlt } from '@fortawesome/free-solid-svg-icons/faUndoAlt';
import { faRedoAlt } from '@fortawesome/free-solid-svg-icons/faRedoAlt';

import Button from '../input/Button';

export type UndoRedoButtonsProps = {
    /**
     * Function called after the undo button was clicked and the last action was
     * undone
     */
    onUndo: () => void;
    /**
     * Function called after the redo button was clicked and the last action was
     * redone
     */
    onRedo: () => void;
    canRedo: () => boolean;
    canUndo: () => boolean;
};

const UndoRedoButtons: React.FunctionComponent<UndoRedoButtonsProps> = (props: UndoRedoButtonsProps) => {
    const { t } = useTranslation(['main', 'notifications']);

    return (
        <div className="tr__form-buttons-container tr__form-selected-object-buttons-container">
            <Button
                title={t('main:Undo')}
                name="undo"
                key="undo"
                color="grey"
                disabled={!props.canUndo()}
                icon={faUndoAlt}
                iconClass="_icon-alone"
                label=""
                onClick={props.onUndo}
            />
            <Button
                title={t('main:Redo')}
                name="redo"
                key="redo"
                color="grey"
                disabled={!props.canRedo()}
                icon={faRedoAlt}
                iconClass="_icon-alone"
                label=""
                onClick={props.onRedo}
            />
        </div>
    );
};

export default UndoRedoButtons;
