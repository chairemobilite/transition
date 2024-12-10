/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { ChangeEvent, JSX } from 'react';

export type InputValue = {
    value: any;
    valid: boolean;
};

export type InputStringProps = {
    id: string;
    /**
     * @deprecated Use onValueUpdated instead. This method passes the value as
     * it is received by the event, callers had to check validity of the
     * received value. With the type and pattern props, the input itself can now
     * verify the validity, thus callers don't have to. If this prop is set,
     * onValueUpdated will be ignored.
     */
    onValueChange?: (e: any) => void;
    /**
     * Function called when the input value has been updated, passed with the
     * validity check of the method. Callers don't have to validate the value.
     * TODO: Make this value mandatory when onValueChange is removed
     */
    onValueUpdated?: (newValue: { value: any; valid: boolean }) => void;
    value?: string;
    maxLength?: number;
    disabled?: boolean;
    autocompleteChoices?: ({ label: string; value: string } | string)[];
    type?: 'text' | 'email' | 'number';
    pattern?: string;
};

type defaultInputType = {
    name: string;
    id: string;
    maxLength: number;
    value?: string;
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    pattern?: string;
};

const InputString: React.FunctionComponent<InputStringProps> = ({
    id,
    onValueChange = undefined,
    onValueUpdated = (_e) => {
        /* nothing to do */
    },
    value = undefined,
    maxLength = 255,
    disabled = false,
    autocompleteChoices = [],
    type = 'text',
    pattern = undefined
}: InputStringProps) => {
    const actualValue = value === undefined || value === null ? '' : value;
    const defaultAttributes: defaultInputType = {
        name: id,
        id: id,
        maxLength: maxLength,
        value: actualValue,
        onChange: onValueChange
            ? onValueChange
            : (evt: React.ChangeEvent<HTMLInputElement>) => {
                onValueUpdated({ value: evt.target.value, valid: evt.target.validity.valid });
            }
    };

    if (disabled === true) {
        defaultAttributes.disabled = true;
    }

    if (pattern) {
        defaultAttributes.pattern = pattern;
    }

    if (autocompleteChoices && autocompleteChoices.length > 0) {
        const dataListOptions: JSX.Element[] = [];
        autocompleteChoices.forEach((autocompleteChoice, key) => {
            dataListOptions.push(
                <option key={key}>
                    {typeof autocompleteChoice === 'string' ? autocompleteChoice : autocompleteChoice.label}
                </option>
            );
        });

        const dataListId = `datalist_for_${id}`;

        return (
            <React.Fragment>
                <input list={dataListId} {...defaultAttributes} />
                <datalist id={dataListId}>{dataListOptions}</datalist>
            </React.Fragment>
        );
    }

    return (
        <input
            type={type}
            autoComplete="none"
            className="apptr__form-input-string apptr__input apptr__input-string"
            {...defaultAttributes}
        />
    );
};

export default InputString;
