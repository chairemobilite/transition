/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// Define prop types for the captcha components
export interface CaptchaProps {
    /**
     * Function to call when the captcha is validated (or not).
     * @param isValid Whether the captcha is valid
     * @param captchaValue The optional value of the captcha, if applicable
     * (e.g., for text or token-based captchas)
     */
    onCaptchaValid: (isValid: boolean, captchaValue?: string) => void;
    // Optional, if the key changes, the captcha will be reset
    reloadKey?: number;
}
