/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import ConfirmModal from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';

interface ButtonCellProps {
    /**
     * How to align this cell. Right and left respectively align to the right
     * and the left, while flush will align to the right filling the empty space
     * before the cell
     */
    alignment: 'right' | 'left' | 'flush';
    children: React.ReactNode;
    title?: string;
    onClick?: React.MouseEventHandler;
}

/**
 * A formatted cell element, to be included into a Button component.
 * @param props
 * @returns
 */
const ButtonCell: React.FunctionComponent<ButtonCellProps> = (props: ButtonCellProps) => {
    const alignmentClass =
        props.alignment === 'left' ? '_left' : props.alignment === 'right' ? '_right' : '_flush-right _right';

    return (
        <span className={`_list-group ${alignmentClass}`} onClick={props.onClick} title={props.title}>
            <span className="_list-element">{props.children}</span>
        </span>
    );
};

interface ButtonCellWithConfirmProps extends ButtonCellProps {
    message: string;
    onClick: React.MouseEventHandler;
    confirmButtonText: string;
    confirmButtonColor?: string;
}

/**
 * A formatted cell element, to be included into a Button component, but with a
 * confirmation message on click
 * @param props
 * @returns
 */
export const ButtonCellWithConfirm: React.FunctionComponent<ButtonCellWithConfirmProps> = (
    props: ButtonCellWithConfirmProps
) => {
    const [confirmModalIsOpen, setConfirmModalIsOpen] = React.useState(false);

    const openConfirmModal: React.MouseEventHandler = React.useCallback((e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        setConfirmModalIsOpen(true);
    }, []);

    const closeConfirmModal: React.MouseEventHandler = React.useCallback((e: React.MouseEvent) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        setConfirmModalIsOpen(false);
    }, []);

    return (
        <React.Fragment>
            <ButtonCell alignment={props.alignment} title={props.title} onClick={openConfirmModal}>
                {props.children}
            </ButtonCell>
            {confirmModalIsOpen && (
                <ConfirmModal
                    isOpen={true}
                    title={props.message}
                    confirmAction={props.onClick}
                    confirmButtonColor={props.confirmButtonColor || 'blue'}
                    confirmButtonLabel={props.confirmButtonText}
                    closeModal={closeConfirmModal}
                />
            )}
        </React.Fragment>
    );
};

export default ButtonCell;
