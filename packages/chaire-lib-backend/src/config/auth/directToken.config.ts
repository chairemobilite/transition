/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { PassportStatic } from 'passport';
import BearerStrategy from 'passport-http-bearer';
import { IAuthModel, IUserModel } from '../../services/auth/authModel';
import config from '../server.config';

// Direct token login strategy: the token will be used as the username. If it
// exists in the database, the user will be logged in, otherwise, it will be
// automatically created.

const isTokenValid = (token: string): boolean => {
    // TODO The token regex format could be validated at the start instead of
    // in this method. But this is called only for new users and it is easier to
    // unit test as it is now, so we keep this here.
    const tokenFormat = (config.auth?.directToken as any)?.tokenFormat;
    let tokenFormatRegex: RegExp | boolean = true;
    try {
        tokenFormatRegex = tokenFormat !== undefined ? new RegExp(tokenFormat) : true;
    } catch {
        console.log(
            'Token format for direct token Regular expression for direct token is not a valid regular expression:',
            tokenFormat
        );
        tokenFormatRegex = false;
    }
    return typeof tokenFormatRegex === 'boolean' ? tokenFormatRegex : token.match(tokenFormatRegex) !== null;
};

export default <U extends IUserModel>(passport: PassportStatic, authModel: IAuthModel<U>) => {
    passport.use(
        'direct-token',
        // We use the bearer strategy, even though this does not implement the
        // bearer tokens specified by RFC 6750. Our token strategy is quite
        // simple and it fits the API of the passport-http-bearer strategy,
        // which is itself very simple and despite what the documentation says,
        // has no mention of the specification or OAuth in its API.
        new BearerStrategy.Strategy(async (token: string, done) => {
            try {
                // Validate the token has the right format
                if (!isTokenValid(token)) {
                    throw 'Invalid token format';
                }
                // Find the user whose username is the token
                const user = await authModel.find({ username: token });
                if (user) {
                    done(null, user.sanitize());
                } else {
                    // The user is not found, create it and log in
                    const newUser = await authModel.createAndSave({
                        username: token
                    });
                    done(null, newUser.sanitize());
                }
            } catch (err) {
                console.error('Error registering or validating user with token:', err);
                return done('InvalidToken');
            }
        })
    );
};
