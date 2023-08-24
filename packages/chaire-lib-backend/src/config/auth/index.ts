/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Unused, but must be imported to make sure the environment is configured at this point, otherwise process.env will have undefined values
import _dotenv from '../dotenv.config'; // eslint-disable-line @typescript-eslint/no-unused-vars
import passport, { PassportStatic } from 'passport';
import GoogleStrategy from 'passport-google-oauth';
import FacebookStrategy from 'passport-facebook';
import url from 'url';
import localLogin from './localLogin.config';
import config from '../server.config';
import { IAuthModel, IUserModel } from '../../services/auth/authModel';

export default <U extends IUserModel>(authModel: IAuthModel<U>): PassportStatic => {
    if (process.env.GOOGLE_OAUTH_CLIENT_ID) {
        passport.use(
            new GoogleStrategy.OAuth2Strategy(
                {
                    clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_OAUTH_SECRET_KEY,
                    callbackURL: new url.URL('/googleoauth', process.env.HOST).href
                },
                (accessToken, refreshToken, profile, done) => {
                    authModel
                        .find({ google_id: profile.id })
                        .then(async (user) => {
                            if (user !== undefined) {
                                // TODO Should sanitize user, but see if other fields need to be included
                                done(null, { ...user });
                            } else {
                                const newUser = await authModel.createAndSave({ googleId: profile.id, isTest: false });
                                done(null, newUser !== null ? newUser.sanitize() : false);
                            }
                            return null;
                        })
                        .catch(() => {
                            return done('Cannot verify google id credentials');
                        });
                }
            )
        );
    }

    if (process.env.FACEBOOK_APP_ID) {
        passport.use(
            new FacebookStrategy(
                {
                    clientID: process.env.FACEBOOK_APP_ID,
                    clientSecret: process.env.FACEBOOK_APP_SECRET,
                    callbackURL: new url.URL('/facebookoauth', process.env.HOST).href
                },
                (accessToken, refreshToken, profile, done) => {
                    authModel
                        .find({ facebook_id: profile.id })
                        .then(async (user) => {
                            if (user !== undefined) {
                                // TODO Should sanitize user, but see if other fields need to be included
                                done(null, { ...user });
                            } else {
                                const newUser = await authModel.createAndSave({
                                    facebookId: profile.id,
                                    isTest: false
                                });
                                done(null, newUser !== null ? newUser.sanitize() : false);
                            }
                            return null;
                        })
                        .catch(() => {
                            return done('Cannot verify facebook id credentials');
                        });
                }
            )
        );
    }

    if (!config.auth || config.auth.localLogin !== undefined || config.separateAdminLoginPage === true) {
        localLogin(passport, authModel);
    }
    if (config.auth && config.auth.passwordless !== undefined) {
        const passwordlessConfig = require('./passwordless.config');
        // FIXME It used to work without the next line, not anymore... probably some compilation issue
        const pwdlessConfig = passwordlessConfig.default ? passwordlessConfig.default : passwordlessConfig;
        pwdlessConfig(passport, authModel);
    }
    if (config.auth && config.auth.anonymous === true) {
        const anonymousLoginStrategy = require('../../services/auth/anonymousLoginStrategy');
        // FIXME It used to work without the next line, not anymore... probably some compilation issue
        const AnonymousLoginStrategy = anonymousLoginStrategy.default
            ? anonymousLoginStrategy.default
            : anonymousLoginStrategy;
        passport.use('anonymous-login', new AnonymousLoginStrategy(authModel));
    }

    // TODO user is Express.User type and does not have an id type
    passport.serializeUser((user: any, done) => {
        done(null, user.id);
        return null;
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const model = await authModel.getById(id as number);
            if (model !== undefined) {
                done(null, model.attributes);
                return null;
            }
            done('User does not exist');
        } catch (error) {
            done(`Cannot deserialize user data, ${error}`);
        }
    });

    return passport;
};
