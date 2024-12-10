/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

export type InputFileProps = {
    id: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    accept?: string;
    inputRef?: React.RefObject<HTMLInputElement>;
    disabled?: boolean;
};

const InputFile: React.FunctionComponent<InputFileProps> = ({
    id,
    onChange,
    accept,
    inputRef,
    disabled
}: InputFileProps) => {
    const inputAttributes = {
        autoComplete: 'none',
        type: 'file',
        accept: accept,
        className: 'tr__form-input-file apptr__input _input-file',
        name: id,
        id: id,
        onChange: onChange,
        disabled: disabled === true ? true : undefined
    };

    return <input {...inputAttributes} ref={inputRef} />;
};

export default InputFile;
