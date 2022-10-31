/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

interface choiceType {
    value: string | boolean;
    [key: string]: unknown;
}

export interface InputRadioProps {
    id: string;
    onValueChange?: (e: any) => void;
    value?: string | boolean;
    defaultValue?: string;
    choices: choiceType[];
    sameLine?: boolean;
    isBoolean?: boolean;
    localePrefix?: string;
    t?: (string) => string;
    disabled?: boolean;
}

interface defaultInputType {
    name: string;
    disabled?: boolean;
}

// TODO: Make a real boolean component

class InputRadio extends React.Component<InputRadioProps> {
    static defaultProps: Partial<InputRadioProps> = {
        onValueChange: undefined,
        value: undefined,
        defaultValue: '',
        choices: [],
        localePrefix: 'main',
        t: (_str) => '',
        sameLine: true,
        isBoolean: false,
        disabled: false
    };

    constructor(props: InputRadioProps) {
        super(props);

        this.handleRadioLabelClick = this.handleRadioLabelClick.bind(this);
        this.handleRadioClick = this.handleRadioClick.bind(this);
        this.handleRadioContainerClick = this.handleRadioContainerClick.bind(this);
        this.handleRadioChange = this.handleRadioChange.bind(this);
    }

    handleRadioLabelClick(e: React.MouseEvent): void {
        e.stopPropagation();
    }

    handleRadioClick(e: React.MouseEvent): void {
        e.stopPropagation();
    }

    handleRadioContainerClick(inputRadioRef: React.RefObject<HTMLInputElement>, e: React.MouseEvent): void {
        e.stopPropagation();
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: false
        });
        if (inputRadioRef.current) {
            inputRadioRef.current.dispatchEvent(clickEvent);
        }
    }

    handleRadioChange(e: any): void {
        e.stopPropagation();
        const onChange = this.props.onValueChange;
        if (onChange) {
            let eventValue: any = e;
            if (this.props.isBoolean) {
                eventValue = { target: { value: e.target.value.toString() === 'true' } };
            }
            onChange(eventValue);
        }
    }

    render(): React.ReactNode {
        const defaultAttributes: defaultInputType = {
            name: this.props.id
        };
        if (this.props.disabled === true) {
            defaultAttributes.disabled = true;
        }

        let value = this.props.value === undefined ? this.props.defaultValue : this.props.value;
        if (!value) {
            value = this.props.isBoolean ? 'false' : '';
        }
        if (this.props.isBoolean) {
            value = value.toString();
        }

        const radioChoices: JSX.Element[] = this.props.choices.map((choice) => {
            const inputRadioRef: React.RefObject<HTMLInputElement> = React.createRef();
            const valueStr = choice.value.toString();
            const id = `${this.props.id}_${valueStr}`;
            return (
                <div
                    className={`tr__form-input-radio-container${valueStr === value ? ' checked' : ''}`}
                    key={valueStr}
                    onClick={(e) => {
                        this.handleRadioContainerClick(inputRadioRef, e);
                    }}
                >
                    <input
                        {...defaultAttributes}
                        autoComplete="none"
                        type="radio"
                        className="tr__form-input-radio apptr__input _input-radio"
                        id={id}
                        checked={valueStr === value}
                        onChange={this.handleRadioChange}
                        onClick={this.handleRadioClick}
                        value={valueStr}
                    />
                    <label htmlFor={id} onClick={this.handleRadioLabelClick}>
                        <span>
                            {(this.props.t && this.props.t(`${this.props.localePrefix || 'main'}:${valueStr}`)) ||
                                valueStr}
                        </span>
                    </label>
                </div>
            );
        });

        return (
            <div
                className={`tr__form-input-radio-group-container _input-proxy${
                    this.props.sameLine === false ? ' no-wrap' : ''
                }`}
            >
                {radioChoices}
            </div>
        );
    }
}

export default InputRadio;
