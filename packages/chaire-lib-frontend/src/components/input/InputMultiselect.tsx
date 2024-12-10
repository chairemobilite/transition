/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Select from 'react-select';

type ChoiceType = {
    value: string;
    disabled?: boolean;
    label?: string;
    choices?: ChoiceType[];
};

type InnerChoiceType = ChoiceType & {
    index: number;
};

// TODO: maybe we should just extend react select and accept any of its config in our component props
export interface InputMultiSelectProps {
    id: string;
    onValueChange: (e: any) => void;
    value: string[];
    defaultValue: string[];
    choices: ChoiceType[];
    multiple?: boolean;
    closeMenuOnSelect: boolean; // wether to close the menu open after selecting a choice or not
    isClearable: boolean; // wether to show the "x" button to clear all selected choices
    localePrefix?: string;
    t: (string) => string;
    disabled?: boolean;
}

interface DefaultInputType {
    name: string;
    id: string;
    [key: string]: any;
}

export class InputMultiselect extends React.Component<InputMultiSelectProps> {
    static defaultProps: Partial<InputMultiSelectProps> = {
        value: [],
        defaultValue: [],
        choices: [],
        multiple: true,
        localePrefix: 'main',
        t: (_str) => '',
        disabled: false
    };

    constructor(props: InputMultiSelectProps) {
        super(props);

        this.onValueChange = this.onValueChange.bind(this);
    }

    onValueChange(valuesArray): void {
        if (valuesArray) {
            if (this.props.multiple !== false) {
                if (!Array.isArray(valuesArray)) {
                    valuesArray = [valuesArray];
                }
                this.props.onValueChange({ target: { value: valuesArray.map((option) => option.value) } });
            } else {
                this.props.onValueChange({ target: { value: valuesArray.value } });
            }
        } else {
            this.props.onValueChange({ target: { value: [] } });
        }
    }

    render(): React.ReactNode {
        const actualValue = this.props.value.length === 0 ? this.props.defaultValue : this.props.value || [];
        const defaultAttributes: DefaultInputType = {
            autoComplete: 'none',
            className: 'tr__form-input-multiselect apptr__input _input-multiselect',
            name: this.props.id,
            id: this.props.id,
            value: actualValue
        };
        if (this.props.onValueChange) {
            defaultAttributes.onChange = this.props.onValueChange;
        }
        if (this.props.disabled === true) {
            defaultAttributes.disabled = true;
            defaultAttributes.isDisabled = true;
        }

        const actualValueWithLabel: InnerChoiceType[] = [];
        const choices = this.props.choices;
        const t = this.props.t;
        const localePrefix = this.props.localePrefix || 'main';
        const selectOptions = choices.map((choice) => {
            const label = choice.label || t(`${localePrefix}:${choice.value}`);
            if (actualValue.indexOf(choice.value) > -1) {
                actualValueWithLabel.push({
                    label: label,
                    //color: choice.color,
                    value: choice.value,
                    index: actualValue.indexOf(choice.value)
                });
            }
            return {
                label: label,
                //color: choice.color,
                value: choice.value
            };
        });

        actualValueWithLabel.sort((valueObjectA: InnerChoiceType, valueObjectB: InnerChoiceType) => {
            return valueObjectA.index - valueObjectB.index;
        });

        const customStyles = {
            control: (base, _state) => ({
                ...base,
                backgroundColor: 'rgba(0,0,0,1.0)',
                /*height: '3rem',
        minHeight: '3rem',
        padding: '0.1rem',*/
                borderColor: 'rgba(255,255,255,0.1)'
            }),
            multiValue: (base, _state) => ({
                ...base,
                backgroundColor: 'rgba(255,255,255,0.2)'
            }),
            multiValueLabel: (base, _state) => ({
                ...base,
                color: 'rgba(255,255,255,0.8)'
            }),
            input: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.0)'
            }),
            placeholder: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.0)'
            }),
            option: (base, state) => ({
                ...base,
                padding: '0.25rem 0.5rem',
                color: 'rgba(255,255,255,1.0)',
                backgroundColor: state.isFocused ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.0)'
            }),
            menu: (base, _state) => ({
                ...base,
                zIndex: 1000,
                marginTop: '0',
                backgroundColor: 'rgba(0,0,0,1.0)'
            })
        };

        return (
            <div className="tr__form-input-multiselect">
                <Select
                    {...defaultAttributes}
                    menuPortalTarget={document.querySelector('body')}
                    isMulti={this.props.multiple !== false}
                    onChange={this.onValueChange}
                    options={selectOptions}
                    isSearchable={true}
                    isClearable={this.props.isClearable || true}
                    closeMenuOnSelect={this.props.closeMenuOnSelect || (this.props.multiple ? false : true)}
                    placeholder=""
                    value={
                        (this.props.multiple !== false ? actualValueWithLabel : actualValueWithLabel[0]) as ChoiceType
                    }
                    className="react-select-container apptr__input _input-multiselect"
                    classNamePrefix="react-select"
                    styles={customStyles}
                />
            </div>
        );
    }
}

export default InputMultiselect;
