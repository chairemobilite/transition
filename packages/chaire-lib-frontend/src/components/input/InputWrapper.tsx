/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

export type InputProps = {
    label: string;
    help?: string;
    smallInput?: boolean;
    twoColumns?: boolean;
};

export type HelpProps = {
    help: string;
};

const InputHelp: React.FunctionComponent<HelpProps> = (props: HelpProps) => {
    return <p className="_em _pale _small _help">{props.help}</p>;
};

export const InputWrapper: React.FunctionComponent<React.PropsWithChildren<InputProps>> = ({
    label,
    help,
    smallInput = false,
    children,
    twoColumns = true
}: React.PropsWithChildren<InputProps>) => {
    const classes = `apptr__form-input-container${twoColumns ? ' _two-columns' : ''}${
        smallInput ? ' _small-inputs' : ''
    }`;
    return (
        <React.Fragment>
            <div className={classes}>
                <label>{label}</label>
                {children}
                {help && (
                    <React.Fragment>
                        <div className={'_flex-break'}></div>
                        <InputHelp help={help}></InputHelp>
                    </React.Fragment>
                )}
            </div>
        </React.Fragment>
    );
};

export default InputWrapper;
