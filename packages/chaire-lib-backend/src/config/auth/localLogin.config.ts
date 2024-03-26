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
import BearerStrategy from 'passport-http-bearer';
import tokensDbQueries from '../../models/db/tokens.db.queries';
import config from '../server.config';
import { sendConfirmationEmail } from '../../services/auth/userEmailNotifications';
import { v4 as uuidV4 } from 'uuid';
import { IAuthModel, IUserModel } from '../../services/auth/authModel';

// FIXME: auth.localLogin is now the way to define local login behavior, setting variables here for legacy purposes
// @Deprecated all config.* that is not in auth, are deprecated and have been moved to auth
const getConfirmEmail = () => config.confirmEmail || config.auth?.localLogin?.confirmEmail;
export const getConfirmEmailStrategy = () =>
    config.confirmEmailStrategy || config.auth?.localLogin?.confirmEmailStrategy;

const getVerifyUrl = (confirmationToken: string): string => {
    const host = process.env.HOST || 'http://localhost:8080';
    return new url.URL(`/verify/${confirmationToken}`, host).href;
};

const sendEmailIfRequired = async (
    user: IUserModel,
    done: (error: any, user?: any, options?: LocalStrategy.IVerifyOptions) => void
) => {
    if (getConfirmEmail() !== true) {
        user.recordLogin();
        done(null, user.sanitize());
        return;
    }
    if (!process.env.HOST) {
        console.error(
            'Environment variable HOST is undefined. Add it to the .env file so the new user confirmation URL can be created'
        );
    } else {
        const confirmUrl = getVerifyUrl(user.confirmationToken || '');
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

export default <U extends IUserModel>(passport: PassportStatic, authModel: IAuthModel<U>) => {
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
                authModel
                    .find({ usernameOrEmail: usernameOrEmail })
                    .then(async (model) => {
                        if (model === undefined) {
                            done('UnknownUser', false);
                            return;
                        }
                        if (await model.verifyPassword(password)) {
                            if (!model.isConfirmed) {
                                done(null, false, { message: 'UnconfirmedUser' });
                            } else {
                                model.recordLogin();
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
        'bearer-strategy',
        new BearerStrategy.Strategy(async (token, done) => {
            try {
                const user = await tokensDbQueries.getUserByToken(token);
                if (!user) throw 'InvalidToken';
                done(null, user);
            } catch (err) {
                return done('InvalidToken');
            }
        })
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
                authModel
                    .find({ username, email: email ? email : username }, true)
                    .then(async (model) => {
                        if (model !== undefined) {
                            done('UserExists', false);
                            return;
                        }
                        const isTest =
                            username.toLowerCase().endsWith('@test.com') ||
                            username.toLowerCase().endsWith('@test') ||
                            username.toLowerCase().endsWith('@test.test');
                        const newUser = await authModel.createAndSave({
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
};
