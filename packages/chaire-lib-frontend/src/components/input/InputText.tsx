/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

export type InputTextProps = {
    id: string;
    onValueChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    rows?: number;
    value?: string;
    placeholder?: string;
    maxLength?: number;
    disabled?: boolean;
};

type defaultInputType = {
    name: string;
    id: string;
    maxLength: number;
    value?: string;
    rows?: number;
    onChange?: React.ChangeEventHandler;
    disabled?: boolean;
    placeholder?: string;
};

const InputText: React.FunctionComponent<InputTextProps> = ({
    id,
    onValueChange = undefined,
    rows = 5,
    value = undefined,
    maxLength = 2000,
    disabled = false,
    placeholder
}: InputTextProps) => {
    const defaultAttributes: defaultInputType = {
        rows: rows,
        name: id,
        id: id,
        disabled: disabled === true ? true : false,
        onChange: onValueChange,
        maxLength: maxLength,
        value: value || ''
    };

    if (placeholder) {
        defaultAttributes.placeholder = placeholder;
    }

    return (
        <textarea
            autoComplete="none"
            className="tr__form-input-textarea apptr__input _input-textarea"
            {...defaultAttributes}
        ></textarea>
    );
};

export default InputText;
