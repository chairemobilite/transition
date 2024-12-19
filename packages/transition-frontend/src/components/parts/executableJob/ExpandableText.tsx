/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export interface ExpandableTextProps {
    textToShorten: string | undefined;
}

const ExpandableText: React.FunctionComponent<React.PropsWithChildren<ExpandableTextProps>> = (
    props: React.PropsWithChildren<ExpandableTextProps>
) => {
    const [expanded, setExpanded] = React.useState(false);
    if (expanded) {
        return (
            <div>
                <FontAwesomeIcon onClick={() => setExpanded(false)} icon={faChevronUp} />
                {props.children}
            </div>
        );
    }
    const stringToShorten = props.textToShorten || '';
    const shortenedText = stringToShorten.length <= 20 ? stringToShorten : `${stringToShorten.substring(0, 20)}...`;
    return <div onClick={() => setExpanded(true)}>{shortenedText}</div>;
};

export default ExpandableText;
