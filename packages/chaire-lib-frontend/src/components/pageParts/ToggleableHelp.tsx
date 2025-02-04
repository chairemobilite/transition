/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons/faInfoCircle';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import Button from '../input/Button';

interface ToggleableHelpProps {
    namespace: string;
    section: string;
    containerClassName?: string;
    contentClassName?: string;
}

const ToggleableHelp: React.FunctionComponent<ToggleableHelpProps> = function (props: ToggleableHelpProps) {
    const {
        namespace,
        section,
        containerClassName = 'tr__toggleable-help',
        contentClassName = 'tr__toggleable-help__content'
    } = props;
    const { t } = useTranslation();
    const [showHelp, setShowHelp] = useState(false);

    const translationPrefix = `${namespace}:${section}`;

    return (
        <div
            title={showHelp ? t(`${translationPrefix}:CloseHelpText`) : t(`${translationPrefix}:ShowHelpText`)}
            className={containerClassName}
        >
            <Button
                icon={showHelp ? faTimes : faInfoCircle}
                iconClass="_icon-alone"
                color="blue"
                onClick={() => setShowHelp(!showHelp)}
            />
            {showHelp && (
                <p
                    className={contentClassName}
                    dangerouslySetInnerHTML={{ __html: t(`${translationPrefix}:HelpText`) }}
                ></p>
            )}
        </div>
    );
};

export default ToggleableHelp;
