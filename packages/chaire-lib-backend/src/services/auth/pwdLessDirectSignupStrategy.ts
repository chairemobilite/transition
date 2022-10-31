/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Request } from 'express';
import { StrategyCreatedStatic } from 'passport';
import MagicLoginStrategy from 'passport-magic-login';

import { saveNewUser } from '../../config/auth/passport.utils';
import UserModel from './user';

/**
 * Passport strategy, which uses a magic link sent by email or sms, but allows a
 * first time user to directly log into the application, without verifying the
 * email first.
 */
class PwdLessDirectSignupStrategy {
    name = 'pwdlessdirectsignup';

    constructor(private _magicLoginStrategy: MagicLoginStrategy) {
        // Nothing to do
    }

    private addNewUser = async (emailOrSms: string) => {
        const newUser = await saveNewUser({
            username: emailOrSms,
            email: emailOrSms,
            isTest: false
        });
        if (newUser !== null) {
            return newUser;
        } else {
            throw 'Cannot save new user';
        }
    };

    async authenticate(this: StrategyCreatedStatic & PwdLessDirectSignupStrategy, req: Request): Promise<void> {
        // Get the email from the payload
        const payload = req.method === 'GET' ? req.query : req.body;
        const emailOrSms = payload.destination;

        // Verify if the email is already in the database
        const model = await new UserModel()
            .query({
                where: { email: emailOrSms },
                orWhere: { username: emailOrSms }
            })
            .fetch({ require: false });

        // If so, use the magicLoginStrategy
        if (model) {
            if (!req.res) {
                this.fail('UseAnotherMethod');
            } else {
                this._magicLoginStrategy.send(req, req.res);
            }
        } else {
            // Otherwise, add the user to the database and consider him as signed up
            try {
                const newUser = await this.addNewUser(emailOrSms);
                this.success(newUser.sanitize());
            } catch (error) {
                console.log('Error signing up new user:', error);
                this.fail('UseAnotherMethod');
            }
        }
    }
}

export default PwdLessDirectSignupStrategy;
