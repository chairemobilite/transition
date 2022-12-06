/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// Unused, but must be imported to make sure the environment is configured at this point, otherwise process.env will have undefined values
import _dotenv from '../dotenv.config'; // eslint-disable-line @typescript-eslint/no-unused-vars
import UserModel from '../../services/auth/user';

interface newUserParams {
    username?: string;
    email?: string;
    generatedPassword?: string;
    googleId?: string;
    facebookId?: string;
    password?: string;
    isTest: boolean;
    confirmationToken?: string;
}

export const saveNewUser = async function (params: newUserParams): Promise<UserModel | null> {
    const userPassword = params.password;
    const user = new UserModel({
        username: params.username || null,
        email: params.email || null,
        google_id: params.googleId || null,
        facebook_id: params.facebookId || null,
        generated_password: params.generatedPassword || null,
        password:
            params.googleId || params.facebookId || !userPassword ? null : UserModel.encryptPassword(userPassword),
        first_name: '',
        last_name: '',
        is_admin: false,
        is_valid: params.isTest === true ? false : true,
        is_test: params.isTest,
        is_confirmed: params.confirmationToken !== undefined ? false : true,
        confirmation_token: params.confirmationToken !== undefined ? params.confirmationToken : null
    });

    try {
        const newUserObj = await user.save();
        return newUserObj;
    } catch (error) {
        console.log(`An error occured when creating the new user: ${error}`);
        return null;
    }
};
