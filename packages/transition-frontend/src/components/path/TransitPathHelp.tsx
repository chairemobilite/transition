/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons/faInfoCircle';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import Button from 'chaire-lib-frontend/lib/components/input/Button';

const TransitPathNodeHelp: React.FunctionComponent<WithTranslation> = function (props: WithTranslation) {
    const [showHelp, setShowHelp] = useState(false);
    return (
        <span
            title={
                showHelp
                    ? props.t('transit:transitPath:HidePathEditHelp')
                    : props.t('transit:transitPath:ShowPathEditHelp')
            }
            style={{ padding: 10, minWidth: 'max-content' }}
        >
            <Button
                icon={showHelp ? faTimes : faInfoCircle}
                iconClass="_icon-alone"
                color="blue"
                onClick={() => setShowHelp(!showHelp)}
            />
            {showHelp && <p dangerouslySetInnerHTML={{ __html: props.t('transit:transitPath:PathEditMapDoc') }}></p>}
        </span>
    );
};

export default withTranslation('transit')(TransitPathNodeHelp);
