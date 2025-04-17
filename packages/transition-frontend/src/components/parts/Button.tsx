/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import ButtonCell, { ButtonCellWithConfirm } from './ButtonCell';

interface ButtonProps extends WithTranslation {
    isSelected: boolean;
    children: React.ReactNode;
    key: string;
    /**
     * Whether to flush align to the right the first edit/duplicate/delete
     * action cell. This should be true if no other cell has been flushed to the
     * right. Default: false
     */
    flushActionButtons?: boolean;
    /**
     * If the object can be selected, an edit icon will be shown in the Button.
     * This handler will also be the default handler when the button is clicked
     * if there are no other
     */
    onSelect?: { handler: React.MouseEventHandler; altText?: string };
    /**
     * If the object can be delete, a delete icon will be shown in the Button.
     * It will show a confirmation modal with the message and the delete handler
     * will be called only if the delete is confirmed.
     */
    onDelete?: { handler: React.MouseEventHandler; altText?: string; message: string };
    /**
     * If the object can be duplicated, a duplication icon will be shown in the
     * Button.
     */
    onDuplicate?: { handler: React.MouseEventHandler; altText: string };
}

/**
 * A list element <li> formatted as a Button. Typically to be used in lists of
 * object to be represented with cell-like elements. Children can be added to
 * the props, they will be displayed at the beginning of the button and
 * additional buttons will be added to edit, duplicate and delete the
 * represented object, depending on the props passed.
 * @param props
 * @returns
 */
const Button: React.FunctionComponent<ButtonProps> = (props: ButtonProps) => {
    const deleteText = props.onDelete ? props.onDelete.altText || props.t('main:Delete') : undefined;
    const flushActionButtons = props.flushActionButtons || false;

    return (
        <React.Fragment key={props.key}>
            <li
                className={`_list${props.isSelected === true ? ' _active' : ''}`}
                onClick={props.onSelect ? props.onSelect.handler : undefined}
                key="containerLink"
            >
                {props.children}
                {props.onSelect && (
                    <ButtonCell
                        key={`${props.key}edit`}
                        alignment={flushActionButtons ? 'flush' : 'right'}
                        title={props.onSelect.altText || props.t('main:Edit')}
                    >
                        <img
                            className="_icon-alone"
                            src={'/dist/images/icons/interface/edit_white.svg'}
                            alt={props.onSelect.altText || props.t('main:Edit')}
                        />
                    </ButtonCell>
                )}
                {props.onDuplicate && (
                    <ButtonCell
                        key={`${props.key}duplicate`}
                        alignment={flushActionButtons && !props.onSelect ? 'flush' : 'right'}
                        onClick={props.onDuplicate.handler}
                        title={props.onDuplicate.altText}
                    >
                        <img
                            className="_icon-alone"
                            src={'/dist/images/icons/interface/copy_white.svg'}
                            alt={props.onDuplicate.altText}
                        />
                    </ButtonCell>
                )}
                {props.onDelete && (
                    <ButtonCellWithConfirm
                        key={`${props.key}delete`}
                        alignment={flushActionButtons && !props.onSelect && !props.onDuplicate ? 'flush' : 'right'}
                        onClick={props.onDelete.handler}
                        title={deleteText}
                        confirmButtonColor="red"
                        confirmButtonText={props.onDelete.altText || props.t('main:Delete')}
                        message={props.onDelete.message}
                    >
                        <img
                            className="_icon-alone"
                            src={'/dist/images/icons/interface/delete_white.svg'}
                            alt={deleteText}
                        />
                    </ButtonCellWithConfirm>
                )}
            </li>
            <li className="_clear" key="clearer"></li>
        </React.Fragment>
    );
};

export default withTranslation('main')(Button);
