/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Unused, but must be imported to make sure the environment is configured at this point, otherwise process.env will have undefined values
import _dotenv from '../dotenv.config'; // eslint-disable-line @typescript-eslint/no-unused-vars
import url from 'url';
import { PassportStatic } from 'passport';
import LocalStrategy from 'passport-local';

import UserModel from '../../services/auth/user';
import { saveNewUser } from './passport.utils';
import config from '../server.config';
import { sendConfirmationEmail } from '../../services/auth/userEmailNotifications';
import { v4 as uuidV4 } from 'uuid';

// FIXME: auth.localLogin is now the way to define local login behavior, setting variables here for legacy purposes
// @Deprecated all config.* that is not in auth, are deprecated and have been moved to auth
const getConfirmEmail = () => config.confirmEmail || config.auth?.localLogin?.confirmEmail;
export const getConfirmEmailStrategy = () =>
    config.confirmEmailStrategy || config.auth?.localLogin?.confirmEmailStrategy;

const getVerifyUrl = (user: UserModel): string => {
    const host = process.env.HOST || 'http://localhost:8080';
    return new url.URL(`/verify/${user.attributes.confirmation_token}`, host).href;
};

const sendEmailIfRequired = async (
    user: UserModel,
    done: (error: any, user?: any, options?: LocalStrategy.IVerifyOptions) => void
) => {
    if (getConfirmEmail() !== true) {
        done(null, user.sanitize());
        return;
    }
    if (!process.env.HOST) {
        console.error(
            'Environment variable HOST is undefined. Add it to the .env file so the new user confirmation URL can be created'
        );
    } else {
        const confirmUrl = getVerifyUrl(user);
        try {
            await sendConfirmationEmail(user, {
                strategy: getConfirmEmailStrategy() || 'confirmByUser',
                confirmUrl
            });
        } catch (error) {
            // TODO: The user will not receive an email, do something about it
            console.error(`Error sending confirmation email: ${error}`);
        }
    }
    done(null, false, { message: 'UnconfirmedUser' });
};

export default function (passport: PassportStatic) {
    passport.use(
        'local-login',
        new LocalStrategy.Strategy(
            { usernameField: 'usernameOrEmail', passwordField: 'password' },
            (
                usernameOrEmail: string,
                password: string,
                done: (error: any, user?: any, options?: LocalStrategy.IVerifyOptions) => void
            ) => {
                // TODO: The previous non bookshelf version of this method checked for master_password. Is that still useful?
                /* if (process.env.MASTER_PASSWORD && password === process.env.MASTER_PASSWORD) {
                    query = 'username = ? OR email = ? OR facebook_id = ? OR google_id = ?'; //password ? `(username = '${usernameOrEmail}' OR email = '${usernameOrEmail}') AND password = crypt('${password}', password)` : `(username = '${usernameOrEmail}' OR email = '${usernameOrEmail}')`;
                    binding = [usernameOrEmail, usernameOrEmail, usernameOrEmail, usernameOrEmail];
                } */
                UserModel.find({ usernameOrEmail: usernameOrEmail })
                    .then(async (model) => {
                        if (model === undefined) {
                            done('UnknownUser', false);
                            return;
                        }
                        if (await model.verifyPassword(password)) {
                            if (!model.attributes.is_confirmed) {
                                done(null, false, { message: 'UnconfirmedUser' });
                            } else {
                                done(null, model.sanitize());
                            }
                        } else {
                            done('PasswordsDontMatch', false);
                        }
                    })
                    .catch((error) => {
                        console.error(`Error connecting to database: ${error}`);
                        done('DatabaseError', false);
                        return;
                    });
            }
        )
    );

    passport.use(
        'local-signup',
        new LocalStrategy.Strategy(
            { usernameField: 'username', passwordField: 'password', passReqToCallback: true },
            (
                req,
                username,
                password,
                done: (error: any, user?: any, options?: LocalStrategy.IVerifyOptions) => void
            ) => {
                const email = req.body.email;
                UserModel.find({ username, email: email ? email : username }, true)
                    .then(async (model) => {
                        if (model !== undefined) {
                            done('UserExists', false);
                            return;
                        }
                        const isTest =
                            username.toLowerCase().endsWith('@test.com') ||
                            username.toLowerCase().endsWith('@test') ||
                            username.toLowerCase().endsWith('@test.test');
                        const newUser = await saveNewUser({
                            username,
                            email,
                            password,
                            isTest,
                            generatedPassword: req.body.generatedPassword,
                            confirmationToken: getConfirmEmail() ? uuidV4() : undefined
                        });
                        if (newUser !== null) {
                            await sendEmailIfRequired(newUser, done);
                        } else {
                            done(null, false);
                        }
                    })
                    .catch((error) => {
                        console.error(`Error verifying user credentials: ${error}`);
                        return done('Cannot connect to database and/or verify user credentials');
                    });
            }
        )
    );
}
