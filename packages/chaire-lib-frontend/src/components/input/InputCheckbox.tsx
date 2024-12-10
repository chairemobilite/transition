/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _chunkify } from 'chaire-lib-common/lib/utils/LodashExtensions';

type choiceType = {
    value: string;
    iconPath?: string;
    label?: string;
    [key: string]: unknown;
};

type InputCheckboxCommonProps = WithTranslation & {
    id: string;
    localePrefix?: string;
    disabled?: boolean;
};

export type InputCheckboxProps = InputCheckboxCommonProps & {
    value?: string[];
    defaultValue?: string[];
    choices: choiceType[];
    columns?: number;
    onValueChange: (e: any) => void;
    allowSelectAll?: boolean;
};

type defaultInputType = {
    name: string;
    disabled?: boolean;
};

class InputCheckboxInner extends React.Component<InputCheckboxProps> {
    static defaultProps: Partial<InputCheckboxProps> = {
        defaultValue: [],
        choices: [],
        columns: 1,
        localePrefix: 'main',
        disabled: false,
        allowSelectAll: false
    };

    constructor(props: InputCheckboxProps) {
        super(props);
        this.onCheckboxInputChange = this.onCheckboxInputChange.bind(this);
        this.onContainerClick = this.onContainerClick.bind(this);
        this.selectAll = this.selectAll.bind(this);
    }

    onContainerClick(value, e) {
        e.stopPropagation();
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: false
        });
        // this.onCheckboxInputChange({target: {value: value}})
    }

    onCheckboxInputChange(e) {
        e.stopPropagation();
        const values = this.props.value;

        const valueSet = new Set(values);
        let choices: string[] = [];
        const isChecked = e.target.checked;

        const checkboxValue = e.target.value;

        // use alt key as a check/uncheck all trigger
        if (serviceLocator && serviceLocator.keyboardManager && serviceLocator.keyboardManager.keyIsPressed('alt')) {
            if (valueSet.has(checkboxValue) && !isChecked) {
                // uncheck all
                choices = [];
            } else if (!valueSet.has(checkboxValue) && isChecked) {
                // check all
                const allChoices = this.props.choices.map((choice) => {
                    return choice.value;
                });
                choices = allChoices;
            }
        } else if (valueSet.has(checkboxValue) && !isChecked) {
            valueSet.delete(checkboxValue);
            choices = Array.from(valueSet);
        } else if (!valueSet.has(checkboxValue) && isChecked) {
            valueSet.add(checkboxValue);
            choices = Array.from(valueSet);
        }
        this.props.onValueChange({ target: { value: choices } });
    }

    onCheckboxClick(e) {
        e.stopPropagation();
    }

    onLabelClick(e) {
        e.stopPropagation();
    }

    selectAll(e: React.MouseEvent, checkAll: boolean): void {
        e.stopPropagation();
        const choices: string[] = checkAll ? this.props.choices.map((choice) => choice.value) : [];
        this.props.onValueChange({ target: { value: choices } });
    }

    render(): React.ReactNode {
        const values = this.props.value ? this.props.value : this.props.defaultValue ? this.props.defaultValue : [];
        const valueSet = new Set(values);
        const choices = this.props.choices;
        const localePrefix = this.props.localePrefix || 'main';
        const choiceInputs = choices.map((choice) => {
            const strValue =
                choice.value !== null && choice.value !== undefined ? choice.value.toString() : choice.value;
            const id = `${this.props.id}_${strValue}`;
            const strLabel = choice.label || this.props.t(`${localePrefix}:${choice.value}`) || choice.value;
            const iconPath = choice.iconPath;
            return (
                <div
                    key={id}
                    onClick={(e) => {
                        this.onContainerClick(choice.value, e);
                    }}
                    className={`tr__form-input-checkbox-container${valueSet.has(choice.value) ? ' checked' : ''}`}
                >
                    <div className="label-input-container">
                        <input
                            type="checkbox"
                            id={id}
                            name={this.props.id}
                            className={'_input-checkbox'}
                            value={strValue}
                            disabled={this.props.disabled === true ? true : false}
                            checked={valueSet.has(choice.value)}
                            onChange={this.onCheckboxInputChange}
                            onClick={this.onCheckboxClick}
                        />
                        <label htmlFor={id} onClick={this.onLabelClick}>
                            {iconPath && (
                                <span>
                                    <img src={iconPath} className="_icon" alt={strLabel} />
                                </span>
                            )}
                            <span>{strLabel}</span>
                        </label>
                    </div>
                </div>
            );
        }, this);

        // separate by columns if needed:
        let columnedChoiceInputs: JSX.Element[] = [];
        if (this.props.columns && this.props.columns > 0) {
            const widgetsByColumn =
                this.props.columns === 1 ? [choiceInputs] : _chunkify(choiceInputs, this.props.columns, true);
            for (let i = 0, count = widgetsByColumn.length; i < count; i++) {
                const columnWidgets = widgetsByColumn[i];
                columnedChoiceInputs.push(
                    <div
                        className={`tr__form-input-checkbox-group-column${this.props.columns === 1 ? ' no-wrap' : ''}`}
                        key={i}
                    >
                        {columnWidgets as JSX.Element[]}
                    </div>
                );
            }
        } else {
            columnedChoiceInputs = choiceInputs;
        }

        let selectAllWidget: JSX.Element | undefined = undefined;
        if (this.props.allowSelectAll && !this.props.disabled) {
            const allChecked = choices.find((choice) => !valueSet.has(choice.value)) === undefined;
            const id = `${this.props.id}_selectAll`;
            selectAllWidget = (
                <div className="tr__form-input-checkbox-group-column" key={id}>
                    <div className="label-input-container">
                        <input
                            type="button"
                            id={id}
                            name={this.props.id}
                            className={'_input-checkbox'}
                            value={
                                this.props.t(
                                    allChecked ? `${localePrefix}:UnselectAll` : `${localePrefix}:SelectAll`
                                ) as string
                            }
                            onClick={(e) => this.selectAll(e, !allChecked)}
                        />
                    </div>
                </div>
            );
        }

        return selectAllWidget ? (
            <div className={'apptr__form-input-container'}>
                {selectAllWidget}
                <div className={'tr__form-input-checkbox-group-container'}>{columnedChoiceInputs}</div>
            </div>
        ) : (
            <div className={'tr__form-input-checkbox-group-container'}>{columnedChoiceInputs}</div>
        );
    }
}

export const InputCheckbox = withTranslation(['main', 'transit'])(InputCheckboxInner);

export interface InputCheckboxBoolProps extends InputCheckboxCommonProps {
    isChecked?: boolean;
    defaultChecked?: boolean;
    label?: string;
    onValueChange: (e: any) => void;
}

class InputCheckboxBooleanInner extends React.Component<InputCheckboxBoolProps> {
    static defaultProps: Partial<InputCheckboxBoolProps> = {
        defaultChecked: false,
        label: 'Yes',
        onValueChange: (_e) => {
            /* nothing to do */
        },
        localePrefix: 'main',
        disabled: false
    };

    private _onValueChange: (e: any) => void;

    constructor(props: InputCheckboxBoolProps) {
        super(props);
        this.innerValueChange = this.innerValueChange.bind(this);
        this._onValueChange = props.onValueChange;
    }

    innerValueChange(e: any): void {
        if (e.target.value.includes('true')) {
            this._onValueChange({ target: { value: true } });
        } else {
            this._onValueChange({ target: { value: false } });
        }
    }

    render(): React.ReactNode {
        return (
            <InputCheckbox
                choices={[{ value: 'true', label: this.props.label }]}
                localePrefix={this.props.localePrefix}
                disabled={this.props.disabled}
                id={this.props.id}
                value={
                    this.props.isChecked
                        ? ['true']
                        : this.props.isChecked !== undefined
                            ? []
                            : this.props.defaultChecked
                                ? ['true']
                                : []
                }
                onValueChange={(e) => this.innerValueChange(e)}
            />
        );
    }
}

export const InputCheckboxBoolean = withTranslation('main')(InputCheckboxBooleanInner);

export default InputCheckbox;
