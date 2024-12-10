/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { MouseEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';

export type ButtonProps = {
    onClick?: React.MouseEventHandler;
    onKeyUp?: React.KeyboardEventHandler;
    href?: string;
    download?: string; // see: https://stackoverflow.com/questions/10049259/change-name-of-download-in-javascript
    label: string;
    type: 'href' | 'button' | 'submit' | 'reset' | undefined;
    inputRef?: React.RefObject<HTMLButtonElement>;
    isVisible?: boolean;
    align?: string;
    color?: string;
    size?: string;
    icon?: IconProp;
    iconClass?: string;
    iconPath?: string;
    disabled?: boolean;
    title?: string;
    name?: string;
    style?: { [key: string]: string };
};

type AnchorAttributesProps = {
    href: string;
    download?: string; // see: https://stackoverflow.com/questions/10049259/change-name-of-download-in-javascript
    className: string;
};

export class Button extends React.Component<ButtonProps> {
    static defaultProps: Partial<ButtonProps> = {
        isVisible: true,
        align: 'center',
        type: 'button',
        color: 'green',
        size: 'large',
        iconClass: '_icon',
        style: {},
        title: undefined,
        name: undefined,
        disabled: false
    };

    constructor(props: ButtonProps) {
        super(props);
        this.onClickButton = this.onClickButton.bind(this);
    }

    onClickButton(event: MouseEvent): void {
        event.preventDefault();

        if (typeof this.props.onClick === 'function') {
            this.props.onClick(event);
        }
    }

    render(): React.ReactNode {
        if (this.props.isVisible === false) {
            return null;
        }

        if (this.props.type === 'href' && this.props.href) {
            const attributes: AnchorAttributesProps = {
                href: this.props.href,
                className: `button ${this.props.color} ${this.props.size}`
            };

            if (this.props.download) {
                attributes.download = this.props.download;
            }

            return (
                <div className={this.props.align} style={this.props.style || {}}>
                    <a {...attributes}>
                        {this.props.icon && (
                            <FontAwesomeIcon icon={this.props.icon} className={`${this.props.iconClass}`} />
                        )}
                        {this.props.iconPath && (
                            <img
                                className={`_icon ${this.props.iconClass}`}
                                src={this.props.iconPath}
                                alt={this.props.label}
                            />
                        )}{' '}
                        {this.props.label}
                    </a>
                </div>
            );
        } else if (this.props.type !== 'href') {
            const attributes: { [key: string]: any } = {};
            if (this.props.disabled) {
                attributes.disabled = true;
            }
            if (this.props.title) {
                attributes.title = this.props.title;
            }
            if (this.props.name) {
                attributes.name = this.props.name;
            }
            if (this.props.onKeyUp) {
                attributes.onKeyUp = this.props.onKeyUp;
            }
            return (
                <div className={this.props.align} style={this.props.style || {}}>
                    <button
                        {...attributes}
                        type={this.props.type}
                        ref={this.props.inputRef}
                        className={`button ${this.props.color} ${this.props.size}${
                            this.props.disabled ? ' disabled' : ''
                        }`}
                        onClick={this.onClickButton}
                    >
                        {this.props.icon && (
                            <FontAwesomeIcon icon={this.props.icon} className={`${this.props.iconClass}`} />
                        )}
                        {this.props.iconPath && (
                            <img
                                className={`_icon ${this.props.iconClass}`}
                                src={this.props.iconPath}
                                alt={this.props.label}
                            />
                        )}{' '}
                        {this.props.label}
                    </button>
                </div>
            );
        }
    }
}

export default Button;
