/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { PropsWithChildren } from 'react';
import Modal from 'react-modal';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type ConfirmModalProps = {
    isOpen: boolean;
    closeModal: React.MouseEventHandler;
    text?: string;
    title: string;
    cancelAction?: React.MouseEventHandler;
    showCancelButton?: boolean;
    showConfirmButton?: boolean;
    cancelButtonLabel?: string;
    confirmButtonLabel?: string;
    cancelButtonColor?: any;
    confirmButtonColor?: any;
    buttons?: { [key: string]: { label: string; color: string; action: React.MouseEventHandler } };
    containsHtml?: boolean;
    confirmAction?: React.MouseEventHandler;
};

// Make sure Modal knows what DOM element is the app container. Available examples in the package documentation all put this line outside the component.
if (!process.env.IS_TESTING) {
    Modal.setAppElement('#app');
}

export const ConfirmModal: React.FC<PropsWithChildren<ConfirmModalProps>> = (props) => {
    const { t } = useTranslation(['main']);

    // Set the app element for accessibility
    React.useEffect(() => {
        if (!process.env.IS_TESTING) {
            const appElement = document.getElementById('app') || document.body;
            Modal.setAppElement(appElement);
        }
    }, []);

    const confirm = (e: React.MouseEvent) => {
        // TODO This should always be a function, test before removing, old code may not know
        if (typeof props.confirmAction === 'function') {
            props.confirmAction(e);
        }
        props.closeModal(e);
    };

    const cancel = (e: React.MouseEvent) => {
        // TODO If defined, this should always be a function, test before removing, old code may not know
        if (typeof props.cancelAction === 'function') {
            props.cancelAction(e);
        }
        props.closeModal(e);
    };

    const buttons = props.buttons;
    const buttonsContent = buttons
        ? Object.keys(buttons).map((key) => (
            <div key={key} className="center">
                <button className={`button ${buttons[key].color || 'blue'}`} onClick={buttons[key].action}>
                    {buttons[key].label}
                </button>
            </div>
        ))
        : [];

    if (!buttons && props.showCancelButton !== false) {
        buttonsContent.push(
            <div key={'cancel'} className="center">
                <button type="button" className={`button ${props.cancelButtonColor || 'grey'}`} onClick={cancel}>
                    {props.cancelButtonLabel || t('main:Cancel')}
                </button>
            </div>
        );
    }
    if (!buttons && props.showConfirmButton !== false) {
        buttonsContent.push(
            <div key={'confirm'} className="center">
                <button type="button" className={`button ${props.confirmButtonColor || 'blue'}`} onClick={confirm}>
                    {props.confirmButtonLabel || t('main:Confirm')}
                </button>
            </div>
        );
    }

    return (
        <Modal
            isOpen={props.isOpen === false ? false : true}
            onRequestClose={cancel}
            className="react-modal"
            overlayClassName="react-modal-overlay"
            contentLabel={props.title}
        >
            <div>
                {props.title && (
                    <div className="center">
                        <Markdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]}>{props.title}</Markdown>
                    </div>
                )}

                {/* Render children if provided, otherwise use text prop with existing logic */}
                {props.children ? (
                    <div className="confirm-popup-content">{props.children}</div>
                ) : props.text ? (
                    props.containsHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: props.text }} />
                    ) : (
                        <div className="confirm-popup">
                            <Markdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]}>{props.text}</Markdown>
                        </div>
                    )
                ) : null}

                <div className={'tr__form-buttons-container _center'}>{buttonsContent}</div>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
