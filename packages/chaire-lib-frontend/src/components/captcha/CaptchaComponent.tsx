/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState, useEffect } from 'react';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import { CaptchaProps } from './CaptchaProps';

// Use a React lazy component to dynamically load the appropriate captcha implementation
const CaptchaComponent: React.FunctionComponent<CaptchaProps> = (props: CaptchaProps) => {
    const [CaptchaImpl, setCaptchaImpl] = useState<React.ComponentType<CaptchaProps> | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Dynamically import the appropriate captcha implementation
        switch (config.captchaComponentType) {
        case 'simple':
            console.warn(
                'The \'simple\' captcha was removed, Cap.js is used instead. Set `captchaComponentType` to \'capjs\' in the project configuration.'
            );
            // falls through
        case 'capjs':
            import('./CapJsCaptcha')
                .then((module) => {
                    setCaptchaImpl(() => module.default);
                })
                .catch((err) => {
                    console.error('Error loading captcha component:', err);
                    setError('Failed to load captcha component');
                });
            break;
        default:
            setError(`Unsupported captcha component type: ${config.captchaComponentType}`);
        }
    }, []);

    if (error) {
        return <div className="captcha-error">{error}</div>;
    }

    if (!CaptchaImpl) {
        return <div className="captcha-loading">Loading captcha...</div>;
    }

    return <CaptchaImpl onCaptchaValid={props.onCaptchaValid} reloadKey={props.reloadKey} />;
};

export default CaptchaComponent;
