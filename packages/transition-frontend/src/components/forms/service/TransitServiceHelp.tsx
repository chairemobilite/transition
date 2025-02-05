/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons/faInfoCircle';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

const TransitServiceHelp: React.FunctionComponent<WithTranslation> = function (props: WithTranslation) {
    const [showHelp, setShowHelp] = useState(false);
    return (
        <div
            title={
                showHelp
                    ? props.t('transit:transitService:HideHelpText')
                    : props.t('transit:transitService:ShowHelpText')
            }
            style={{ padding: 10, flexShrink: 1, maxWidth: '100%', overflow: 'auto' }}
        >
            <Button
                icon={showHelp ? faTimes : faInfoCircle}
                iconClass="_icon-alone"
                color="blue"
                onClick={() => setShowHelp(!showHelp)}
            />
            {showHelp && (
                <p
                    style={{
                        maxWidth: '100%',
                        whiteSpace: 'normal',
                        padding: '10px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                    dangerouslySetInnerHTML={{ __html: props.t('transit:transitService:HelpText') }}
                ></p>
            )}
        </div>
    );
};

export default withTranslation('transit')(TransitServiceHelp);

