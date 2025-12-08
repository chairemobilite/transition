/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Modal from 'react-modal';
import { JobAttributes, JobDataType } from 'transition-common/lib/services/jobs/Job';
import { useTranslation } from 'react-i18next';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';

export interface ExpandableMessagesProps {
    messages: Exclude<JobAttributes<JobDataType>['statusMessages'], undefined>;
}

// Make sure Modal knows what DOM element is the app container. Available examples in the package documentation all put this line outside the component.
if (!process.env.IS_TESTING) {
    Modal.setAppElement('#app');
}

const ExpandableMessage: React.FunctionComponent<React.PropsWithChildren<ExpandableMessagesProps>> = (
    props: React.PropsWithChildren<ExpandableMessagesProps>
) => {
    const [expanded, setExpanded] = React.useState(false);
    const { t } = useTranslation('transit');

    const closeModal = () => {
        setExpanded(false);
    };

    if (!expanded) {
        return (
            <button
                type="button"
                className="expandable-messages__trigger"
                onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(true);
                }}
            >
                {t('transit:jobs:ViewWarningsAndErrors')}
            </button>
        );
    }

    return (
        <Modal
            isOpen={expanded}
            onRequestClose={closeModal}
            className="react-modal"
            overlayClassName="react-modal-overlay"
            contentLabel={t('transit:jobs:WarningsAndErrors')}
        >
            <div>
                <div className="center">
                    <h3>{t('transit:jobs:WarningsAndErrors')}</h3>
                </div>
                <div className="confirm-popup">
                    {props.messages.errors && props.messages.errors.length > 0 && (
                        <FormErrors errors={props.messages.errors} errorType="Error" />
                    )}
                    {props.messages.warnings && props.messages.warnings.length > 0 && (
                        <FormErrors errors={props.messages.warnings} errorType="Warning" />
                    )}
                </div>
                <div className={'tr__form-buttons-container _center'}>
                    <div className="center">
                        <button className="button blue" onClick={closeModal}>
                            {t('main:Close')}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ExpandableMessage;
