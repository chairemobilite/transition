/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _set from 'lodash.set';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import moment from 'moment';
import url from 'url';

import passport from '../config/auth';
import User, { sanitizeUserAttributes, UserAttributes } from '../services/auth/user';
// TODO Responsibility for user login management is usually in passport, move it there
import { resetPasswordEmail } from '../services/auth/userEmailNotifications';
import config from '../config/server.config';

const defaultSuccessCallback = (req: Request, res: Response) => {
    // Handle success
    return res.status(200).json({
        user: req.user,
        status: 'Login successful!'
    });
};

const defaultFailureCallback = (err, _req: Request, res: Response, _next) => {
    // Handle error
    if (!res.statusCode) {
        res.status(200);
    }
    return res.json({
        error: err,
        status: 'User not authenticated'
    });
};

export default function(app: express.Express) {
    app.get(
        '/googlelogin',
        passport.authenticate('google', { scope: 'https://www.googleapis.com/auth/userinfo.email' })
    );
    app.get('/googleoauth', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
        //console.log('GOOGLE LOGIN');
        if (req.user) {
            res.redirect('/survey');
        } else {
            return res.status(200).json({
                error: 'User not authenticated'
            });
        }
    });

    app.get('/facebooklogin', passport.authenticate('facebook'));
    app.get('/facebookoauth', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
        //console.log('FACEBOOK LOGIN');
        if (req.user) {
            res.redirect('/survey');
        } else {
            return res.status(200).json({
                error: 'User not authenticated'
            });
        }
    });

    app.get('/verifyAuthentication', (req, res) => {
        if (req.isAuthenticated() && req.user) {
            return res.status(200).json({
                user: sanitizeUserAttributes(req.user as UserAttributes),
                status: 'Login successful!'
            });
        } else {
            return res.status(200).json({
                error: 'User not authenticated'
            });
        }
    });

    app.post(
        '/login',
        passport.authenticate('local-login', { failWithError: true, failureMessage: true }),
        defaultSuccessCallback,
        defaultFailureCallback
    );

    if (config.auth && config.auth.passwordless) {
        app.post(
            '/pwdless',
            passport.authenticate('passwordless-enter-login'),
            defaultSuccessCallback,
            defaultFailureCallback
        );

        app.get(
            '/pwdless/verify',
            passport.authenticate('passwordless-login'),
            (req, res) => {
                // TODO Is it possible to type the authInfo? It's just an interface
                const referrer = req.authInfo ? (req.authInfo as any).referrer : undefined;
                // Handle success
                return res.status(200).json({
                    user: req.user,
                    referrer,
                    status: 'Login successful!'
                });
            },
            defaultFailureCallback
        );
    }

    if (config.auth && config.auth.anonymous === true) {
        app.get('/anonymous', passport.authenticate('anonymous-login'), defaultSuccessCallback, defaultFailureCallback);
    }

    app.post('/verify', async (req, res) => {
        try {
            const response = await User.confirmAccount(req.body.token);
            return res.status(200).json({
                status: response
            });
        } catch (error) {
            return res.status(200).json({
                status: 'Error'
            });
        }
    });

    app.get('/logout', (req, res) => {
        req.logout({}, (err) => {
            if (err !== undefined) {
                console.error(`Error logging out: ${err}. Will destroy session anyway.`);
            }
            req.session.destroy(() => {
                return res.status(200).json({
                    loggedOut: true,
                    status: 'Logout successful!'
                });
            });
        });
    });

    app.post(
        '/register',
        passport.authenticate('local-signup', { failWithError: true, failureMessage: true }),
        (req: Request, res: Response) => {
            return res.status(200).json({
                user: req.user,
                status: 'Registration successful!'
            });
        },
        defaultFailureCallback
    );

    app.post('/update_user_preferences', (req, res) => {
        const valuesByPath = req.body.valuesByPath;
        if (req.isAuthenticated() && req.user) {
            const _user = new User({ ...req.user });
            const preferences = Object.assign({}, _user.get('preferences'));
            if (Object.keys(valuesByPath).length > 0) {
                for (const path in valuesByPath) {
                    _set(preferences, path, valuesByPath[path]);
                }
            }
            _user.set('preferences', preferences);
            _user
                .save()
                .then((_data) => {
                    res.status(200).json({
                        status: 'success'
                    });
                })
                .catch((error) => {
                    console.log(error);
                    return res.status(200).json({
                        status: 'error',
                        error
                    });
                });
            return null;
        } else {
            console.log('not logged in!');
            //return res.redirect(307, '/login');
        }
    });

    app.get('/reset_user_preferences', async (req, res) => {
        if (req.isAuthenticated() && req.user) {
            const _user = new User({ ...req.user });
            _user.set('preferences', {});
            try {
                await _user.save();
                return res.status(200).json({
                    status: 'success'
                });
            } catch (error) {
                console.log(error);
                return res.status(200).json({
                    status: 'error',
                    error
                });
            }
        } else {
            console.log('not logged in!');
            return res.status(401).json({ status: 'Unauthorized' });
        }
    });

    app.post('/forgot', async (req, res) => {
        const token = crypto.randomBytes(20).toString('hex');
        try {
            // TODO Responsibility for user login management is usually in passport, move it there
            const user = await new User()
                .query({
                    where: { email: req.body.email }
                })
                .fetch({ require: false });

            if (!user) {
                return res.status(200).json({
                    status: 'ok',
                    emailExists: false
                });
            }

            user.set('password_reset_token', token);
            user.set('password_reset_expire_at', moment(Date.now() + 86400000)); // 1 day);
            const updatedUser = await user.save();

            const host = process.env.HOST || 'http://localhost:8080';
            const resetPasswordUrl = new url.URL(`/reset/${updatedUser.get('password_reset_token')}`, host).href;
            resetPasswordEmail(updatedUser, { resetPasswordUrl });

            return res.status(200).json({
                status: 'ok',
                emailExists: true
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                status: 'error',
                error
            });
        }
    });

    app.post('/reset/:token', async (req, res) => {
        try {
            const newPwd = req.body.newPassword ? req.body.newPassword : undefined;
            const response = await User.resetPassword(req.params.token, newPwd);
            return res.status(200).json({
                status: response
            });
        } catch (error) {
            console.error('Error resetting password: ', error);
            return res.status(500).json({
                status: 'Error'
            });
        }
    });
}
