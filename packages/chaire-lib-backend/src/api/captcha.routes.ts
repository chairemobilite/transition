/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express, { Request, Response, NextFunction } from 'express';

import config from '../config/server.config';
import { fileManager } from '../utils/filesystem/fileManager';

// Define the type for the validation function
export type CaptchaValidationFunction = (token: string, opts: { keepToken: boolean }) => Promise<boolean>;

// This variable will hold the validation function once the library is loaded
let validateCaptcha: CaptchaValidationFunction | undefined = undefined;

// Define where to look for the token in the request
export interface CaptchaMiddlewareOptions {
    tokenField?: string; // Field name to look for in req.body
    queryParam?: string; // Query parameter to look for
    headerName?: string; // Header to look for
    errorStatusCode?: number; // Status code to return on failure (default: 403)
    errorMessage?: string; // Error message to return
    /**
     * Whether to re-use or delete the token after validation. If set to `true`,
     * many requests can re-use the same captcha token, as long as the token
     * does not expire or the server restarts. If `false, once a request is done
     * with a captcha token, then the server will delete the token and it cannot
     * be used again in queries. The user will have to answer to the captcha
     * once again, with a new token, so the forms calling the routes with
     * `keepToken` set to `false` should make sure that upon errors from the
     * server, if a subsequent call to the backend has to be done, a new token
     * will have to be generated.  Defaults to `false`
     */
    keepToken?: boolean;
}

const defaultMiddlewareOptions: Required<CaptchaMiddlewareOptions> = {
    tokenField: 'captchaToken',
    queryParam: 'captchaToken',
    headerName: 'X-Captcha-Token',
    errorStatusCode: 403,
    errorMessage: 'Captcha validation failed',
    keepToken: false // Default to using the token only once
};

export default (router: express.Router) => {
    // Setup routes based on captcha type
    const setupCaptchaRoutes = async () => {
        switch (config.captchaComponentType) {
        case 'capjs':
            try {
                const capjs = await import('@cap.js/server');
                const Cap = capjs.default;
                const cap = new Cap({
                    tokens_store_path: fileManager.getAbsolutePath('capjs-tokens.json')
                });

                // Set up routes
                router.post('/captcha/challenge', (req, res) => {
                    res.json(cap.createChallenge());
                });

                router.post('/captcha/redeem', async (req, res) => {
                    const { token, solutions } = req.body;
                    if (!token || !solutions) {
                        return res.status(400).json({ success: false });
                    }
                    res.json(await cap.redeemChallenge({ token, solutions }));
                });

                // Define the validation function
                validateCaptcha = async (token: string, opts): Promise<boolean> => {
                    try {
                        const validationResult = await cap.validateToken(token, { keepToken: opts.keepToken });
                        return validationResult.success === true;
                    } catch (error) {
                        console.error('CapJS validation error:', error);
                        return false;
                    }
                };

                console.log('Cap.js captcha configured successfully');
            } catch (error) {
                console.error('Failed to load Cap.js:', error);
            }
            break;
        default:
            // Default case with no captcha or other captcha styles
            validateCaptcha = async (): Promise<boolean> => {
                // Just return true
                return true;
            };
        }
    };

    // Invoke setup immediately
    setupCaptchaRoutes().catch((err) => {
        console.error('Error setting up captcha routes:', err);
    });
};

/**
 * Express middleware that validates a captcha token.
 * The implementation depends on the configured captcha type.
 *
 * @param options Configuration options for the middleware
 * @returns Express middleware function
 */
export const validateCaptchaToken = (options: CaptchaMiddlewareOptions = {}) => {
    // Merge with default options
    const opts: Required<CaptchaMiddlewareOptions> = { ...defaultMiddlewareOptions, ...options };

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Check if validation function is initialized
        if (!validateCaptcha) {
            console.warn('Captcha validation middleware called before initialization');
            res.status(opts.errorStatusCode!).json({
                success: false,
                message: 'Captcha validation service not available'
            });
            return;
        }

        // Try to get token from various places in the request
        const token =
            (req.body && opts.tokenField && req.body[opts.tokenField]) ||
            (opts.queryParam && (req.query[opts.queryParam] as string)) ||
            (opts.headerName && req.headers[opts.headerName.toLowerCase()]);

        // No token provided
        if (!token) {
            res.status(opts.errorStatusCode!).json({
                success: false,
                message: 'Captcha token not provided'
            });
            return;
        }

        try {
            // Validate the token
            const isValid = await validateCaptcha(token, { keepToken: opts.keepToken });
            if (isValid) {
                // Token is valid, proceed with request
                return next();
            } else {
                // Token is invalid
                res.status(opts.errorStatusCode!).json({
                    success: false,
                    message: opts.errorMessage
                });
                return;
            }
        } catch (error) {
            console.error('Error validating captcha token:', error);
            res.status(500).json({
                success: false,
                message: 'Internal error validating captcha'
            });
            return;
        }
    };
};
