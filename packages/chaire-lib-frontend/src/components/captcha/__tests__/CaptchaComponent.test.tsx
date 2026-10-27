/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import CaptchaComponent from '../CaptchaComponent';

jest.mock('../CapJsCaptcha', () => ({
    __esModule: true,
    default: () => <div>Cap.js captcha</div>
}));

const originalCaptchaType = config.captchaComponentType;

afterEach(() => {
    config.captchaComponentType = originalCaptchaType;
    jest.restoreAllMocks();
});

describe('CaptchaComponent', () => {
    test('should load the Cap.js captcha', async () => {
        config.captchaComponentType = 'capjs';
        render(<CaptchaComponent onCaptchaValid={jest.fn()} />);
        expect(await screen.findByText('Cap.js captcha')).toBeTruthy();
    });

    test('should warn and load the Cap.js captcha for the simple captcha, which was removed', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        config.captchaComponentType = 'simple';
        render(<CaptchaComponent onCaptchaValid={jest.fn()} />);
        expect(await screen.findByText('Cap.js captcha')).toBeTruthy();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("The 'simple' captcha was removed"));
    });

    test('should show an error for an unsupported captcha type', async () => {
        config.captchaComponentType = 'unsupported' as any;
        render(<CaptchaComponent onCaptchaValid={jest.fn()} />);
        expect(await screen.findByText('Unsupported captcha component type: unsupported')).toBeTruthy();
    });
});
