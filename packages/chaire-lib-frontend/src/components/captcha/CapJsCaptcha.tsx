/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useEffect, useRef } from 'react';
import { CapWidget, CapWidgetElement } from '@pitininja/cap-react-widget';
import { useTranslation } from 'react-i18next';
import { CaptchaProps } from './CaptchaProps';

const ENDPOINT = '/captcha/';

// FIXME The widget loads a file from cdn.jsdelivr.net, which is not ideal for
// production. We should consider hosting the wasm library ourselves.
const CapJsCaptcha = ({ onCaptchaValid, reloadKey }: CaptchaProps) => {
    const { t } = useTranslation('auth');
    const widgetRef = useRef<CapWidgetElement | null>(null);

    useEffect(() => {
        // Reset the widget if the reloadKey changes
        widgetRef.current?.dispatchEvent('reset');
    }, [reloadKey]);

    return (
        <CapWidget
            ref={widgetRef}
            endpoint={ENDPOINT}
            onSolve={(token) => {
                onCaptchaValid(true, token);
            }}
            onError={() => {
                onCaptchaValid(false);
            }}
            i18nError={t('auth:CapJScaptcha:errorLabel')}
            i18nInitial={t('auth:CapJScaptcha:initialLabel')}
            i18nSolved={t('auth:CapJScaptcha:solvedLabel')}
            i18nVerifying={t('auth:CapJScaptcha:verifyingLabel')}
        />
    );
};

export default CapJsCaptcha;
