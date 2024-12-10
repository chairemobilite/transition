/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Modal from 'react-modal';
import { withTranslation, WithTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type ConfirmModalProps = WithTranslation & {
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

export class ConfirmModal extends React.Component<ConfirmModalProps> {
    constructor(props) {
        super(props);
        if (!process.env.IS_TESTING) {
            Modal.setAppElement('#app');
        }
    }

    confirm = (e: React.MouseEvent) => {
        // TODO This should always be a function, test before removing, old code may not know
        if (typeof this.props.confirmAction === 'function') {
            this.props.confirmAction(e);
        }
        this.props.closeModal(e);
    };

    cancel = (e: React.MouseEvent) => {
        // TODO If defined, this should always be a function, test before removing, old code may not know
        if (typeof this.props.cancelAction === 'function') {
            this.props.cancelAction(e);
        }
        this.props.closeModal(e);
    };

    render() {
        const buttons = this.props.buttons;
        const buttonsContent = buttons
            ? Object.keys(buttons).map((key) => (
                <div key={key} className="center">
                    <button className={`button ${buttons[key].color || 'blue'}`} onClick={buttons[key].action}>
                        {buttons[key].label}
                    </button>
                </div>
            ))
            : [];

        if (!buttons && this.props.showCancelButton !== false) {
            buttonsContent.push(
                <div key={'cancel'} className="center">
                    <button className={`button ${this.props.cancelButtonColor || 'grey'}`} onClick={this.cancel}>
                        {this.props.cancelButtonLabel || this.props.t('main:Cancel')}
                    </button>
                </div>
            );
        }
        if (!buttons && this.props.showConfirmButton !== false) {
            buttonsContent.push(
                <div key={'confirm'} className="center">
                    <button className={`button ${this.props.confirmButtonColor || 'blue'}`} onClick={this.confirm}>
                        {this.props.confirmButtonLabel || this.props.t('main:Confirm')}
                    </button>
                </div>
            );
        }

        return (
            <Modal
                isOpen={this.props.isOpen === false ? false : true}
                onRequestClose={this.cancel}
                className="react-modal"
                overlayClassName="react-modal-overlay"
                contentLabel={this.props.title}
            >
                <div>
                    {this.props.title && (
                        <div className="center">
                            <Markdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]}>
                                {this.props.title}
                            </Markdown>
                        </div>
                    )}
                    {this.props.text &&
                        (this.props.containsHtml ? (
                            <div dangerouslySetInnerHTML={{ __html: this.props.text }} />
                        ) : (
                            <Markdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} className="confirm-popup">
                                {this.props.text}
                            </Markdown>
                        ))}
                    <div className={'tr__form-buttons-container _center'}>{buttonsContent}</div>
                </div>
            </Modal>
        );
    }
}

export default withTranslation('main')(ConfirmModal);
