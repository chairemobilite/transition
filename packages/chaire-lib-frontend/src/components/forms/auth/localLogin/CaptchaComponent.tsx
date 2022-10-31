/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
// FIXME Using the NoReload captcha (which can pose problems to users) because the "Reload Captcha" text is hardcoded in english. Switch when https://github.com/masroorejaz/react-simple-captcha/pull/2 is accepted
import {
    loadCaptchaEnginge,
    LoadCanvasTemplateNoReload,
    validateCaptcha as validateCaptchaMain
} from 'react-simple-captcha';

export interface CaptchaComponentProps {
    value?: string;
    onChange: React.ChangeEventHandler;
}

export const validateCaptcha = (value?: string): boolean => {
    return validateCaptchaMain(value, true);
};

export const CaptchaComponent: React.FunctionComponent<CaptchaComponentProps & WithTranslation> = (
    props: CaptchaComponentProps & WithTranslation
) => {
    React.useEffect(() => {
        loadCaptchaEnginge(6);
    }, []);

    return (
        <React.Fragment>
            <div>
                <LoadCanvasTemplateNoReload />
            </div>
            <div className="apptr__form-input-container">
                <label className="_flex">{props.t('auth:EnterCaptchaText')}</label>
                <input
                    name="user_captcha"
                    type="text"
                    className={'apptr__form-input apptr__form-input-string apptr__input apptr__input-string'}
                    value={props.value}
                    onChange={props.onChange}
                />
            </div>
        </React.Fragment>
    );
};

export default withTranslation('auth')(CaptchaComponent);
