/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons/faExclamationTriangle';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

export type FormErrorsProps = WithTranslation & {
    errors: ErrorMessage[];
    errorType?: 'Warning' | 'Error';
};

const FormErrors: React.FunctionComponent<FormErrorsProps> = (props: FormErrorsProps) => {
    if (props.errors && props.errors.length > 0) {
        return (
            <div className="apptr__form-errors-container">
                {props.errors.map((errorMessage) => {
                    const translatedText =
                        typeof errorMessage === 'object'
                            ? props.t(errorMessage.text, errorMessage.params)
                            : props.t(errorMessage);
                    return (
                        <p
                            key={translatedText}
                            className={`${
                                props.errorType === 'Warning'
                                    ? 'apptr__form-warning-message'
                                    : 'apptr__form-error-message'
                            } _strong`}
                        >
                            <FontAwesomeIcon icon={faExclamationTriangle} className="_icon" />
                            {translatedText}
                        </p>
                    );
                })}
            </div>
        );
    } else {
        return null;
    }
};

export default withTranslation('auth')(FormErrors);
