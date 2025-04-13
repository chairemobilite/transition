/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { JSX } from 'react';

export type choiceType = {
    value: string;
    disabled?: boolean;
    label?: string;
    className?: string;
    choices?: choiceType[];
    [key: string]: unknown;
};

export type InputSelectProps = {
    id: string;
    onValueChange?: (e: any) => void;
    value?: string;
    defaultValue?: string;
    noBlank?: boolean;
    choices?: choiceType[];
    localePrefix?: string;
    t?: (string) => string;
    disabled?: boolean;
};

type defaultInputType = {
    name: string;
    id: string;
    value?: string;
    defaultValue?: string;
    onChange?: (e: any) => void;
    disabled?: boolean;
};

const InputSelect: React.FunctionComponent<InputSelectProps> = ({
    id,
    onValueChange = undefined,
    value = undefined,
    defaultValue = '',
    noBlank = false,
    choices = [],
    localePrefix = 'main',
    t = (_str) => '',
    disabled = false
}: InputSelectProps) => {
    const actualValue = value === undefined ? defaultValue : value;
    const defaultAttributes: defaultInputType = {
        name: id,
        id: id,
        value: actualValue
    };

    if (onValueChange) {
        defaultAttributes.onChange = onValueChange;
    }

    if (disabled === true) {
        defaultAttributes.disabled = true;
    }

    const selectChoices: JSX.Element[] = [];
    for (let i = 0, count = choices.length; i < count; i++) {
        const choice = choices[i];
        if (choice.choices) {
            const childChoices = choice.choices.map((childChoice) => {
                return (
                    <option
                        key={`choice_${childChoice.value}`}
                        value={childChoice.value}
                        disabled={childChoice.disabled === true}
                    >
                        {childChoice.label || t(`${localePrefix}:${childChoice.value}`)}
                    </option>
                );
            });
            selectChoices.push(
                <optgroup
                    key={`group_${choice.value}`}
                    label={choice.label || t(`${localePrefix}:${choice.value}`)}
                >
                    {childChoices}
                </optgroup>
            );
        } else {
            selectChoices.push(
                <option
                    key={`choice_${choice.value}`}
                    value={choice.value}
                    disabled={choice.disabled === true}
                    className={choice.className}
                >
                    {choice.label || t(`${localePrefix}:${choice.value}`)}
                </option>
            );
        }
    }

    return (
        <select {...defaultAttributes}>
            {!noBlank && <option value=""></option>}
            {selectChoices}
        </select>
    );
};

export default InputSelect;
