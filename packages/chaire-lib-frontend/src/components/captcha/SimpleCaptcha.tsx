/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { loadCaptchaEnginge, LoadCanvasTemplate, validateCaptcha } from 'react-simple-captcha';
import { CaptchaProps } from './CaptchaProps';

export const CaptchaComponent: React.FunctionComponent<CaptchaProps> = (props: CaptchaProps) => {
    const { t } = useTranslation('auth');
    const [value, setValue] = React.useState<string>('');
    useEffect(() => {
        loadCaptchaEnginge(6);
    }, []);

    useEffect(() => {
        // Do not reset the value or set parent validation status as we want to
        // keep the captcha if it was valid
        validateCaptcha(value, true);
    }, [props.reloadKey]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        if (validateCaptcha(e.target.value, false)) {
            props.onCaptchaValid(true, e.target.value);
        } else {
            props.onCaptchaValid(false);
        }
    };

    return (
        <React.Fragment>
            <div>
                <LoadCanvasTemplate reloadText={t('auth:ReloadCaptchaText')} />
            </div>
            <div className="apptr__form-input-container">
                <label className="_flex">{t('auth:EnterCaptchaText')}</label>
                <input
                    name="userCaptcha"
                    type="text"
                    className={'apptr__form-input apptr__form-input-string apptr__input apptr__input-string'}
                    value={value}
                    onChange={handleChange}
                />
            </div>
        </React.Fragment>
    );
};

export default CaptchaComponent;
