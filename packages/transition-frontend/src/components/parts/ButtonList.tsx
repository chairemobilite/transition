/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

interface ButtonListProps {
    /**
     * Additional classes to give to this list
     */
    className?: string;
    children: React.ReactNode;
}

/**
 * A formatted list of buttons. Children can be Button elements
 * @param props
 * @returns
 */
const ButtonList: React.FunctionComponent<ButtonListProps> = (props: ButtonListProps) => {
    return <ul className={`_list-container${props.className ? ` ${props.className}` : ''}`}>{props.children}</ul>;
};

export default ButtonList;
