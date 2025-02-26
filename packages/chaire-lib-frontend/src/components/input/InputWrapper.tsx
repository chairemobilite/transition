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
    textColor?: string; //Can be any valid CSS color format: https://www.w3schools.com/css/css_colors.asp
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
    twoColumns = true,
    textColor = undefined
}: React.PropsWithChildren<InputProps>) => {
    const classes = `apptr__form-input-container${twoColumns ? ' _two-columns' : ''}${
        smallInput ? ' _small-inputs' : ''
    }`;

    const textColorStyle = textColor === undefined ? {} : { color: textColor };

    return (
        <React.Fragment>
            <div className={classes}>
                <label style={textColorStyle}>{label}</label>
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
