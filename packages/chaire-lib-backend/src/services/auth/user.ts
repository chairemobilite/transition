/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import bookshelf from '../../config/shared/bookshelf.config';
import bcrypt from 'bcryptjs';
import moment from 'moment';
import { BaseUser } from 'chaire-lib-common/lib/services/user/userType';
import { serializePermissions } from './authorization';
import { getHomePage } from './userPermissions';

export type UserAttributes = {
    id: number;
    uuid: string;
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    is_valid?: boolean;
    is_admin?: boolean;
    is_confirmed?: boolean;
    confirmation_token?: string;
    permissions?: { [key: string]: boolean };
    profile?: { [key: string]: any };
    preferences?: { [key: string]: any };
    generated_password?: string;
    is_test?: boolean;
    google_id?: string;
    facebook_id?: string;
    // TODO Type to datetime string
    created_at?: string;
    updated_at?: string;
    password?: string;
    password_reset_expire_at?: string;
    password_reset_token?: string;
    // TODO What is this?
    batch_shortname?: string;
};

export const sanitizeUserAttributes = (attributes: UserAttributes): BaseUser => {
    // TODO: Sign serialized permissions with JWT token or other
    return {
        id: attributes.id,
        username: attributes.username || '',
        email: attributes.email,
        preferences: attributes.preferences || {},
        firstName: attributes.first_name,
        lastName: attributes.last_name,
        serializedPermissions: serializePermissions(attributes),
        homePage: getHomePage(attributes)
    };
};

export default class UserModel extends bookshelf.Model<UserModel> {
    static encryptPassword = (password: string): string => {
        return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    };

    static confirmAccount = async (
        token: string,
        actionCallback?: (user: UserModel) => void
    ): Promise<'Confirmed' | 'NotFound'> => {
        const user = await UserModel.where<UserModel>({ confirmation_token: token }).fetch({ require: false });
        if (!user) {
            return 'NotFound';
        }
        user.set({ confirmation_token: null, is_confirmed: true });
        await user.save();
        if (actionCallback) {
            actionCallback(user);
        }
        return 'Confirmed';
    };

    static resetPassword = async (
        resetToken: string,
        newPassword?: string
    ): Promise<'Confirmed' | 'NotFound' | 'Expired' | 'PasswordChanged'> => {
        const user = await UserModel.where<UserModel>({ password_reset_token: resetToken }).fetch({ require: false });
        if (!user) {
            return 'NotFound';
        }
        if (moment(Date.now()).isAfter(user.get('password_reset_expire_at'))) {
            return 'Expired';
        }
        if (newPassword) {
            user.set({
                password: UserModel.encryptPassword(newPassword),
                password_reset_token: null,
                password_reset_expire_at: null
            });
            await user.save();
            return 'PasswordChanged';
        }
        return 'Confirmed';
    };

    // TODO Type the user Data and user attributes
    static createAndSave = async (userData: { [key: string]: any }): Promise<{ [key: string]: any }> => {
        const user = new UserModel({
            username: userData.username || null,
            email: userData.email || null,
            google_id: userData.googleId || null,
            facebook_id: userData.facebookId || null,
            generated_password: userData.generatedPassword || null,
            password: userData.password || null,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            is_admin: userData.is_admin || false,
            is_valid: userData.isTest === true ? false : true,
            is_test: userData.isTest,
            is_confirmed: true,
            confirmation_token: null
        });

        const newUserObj = await user.save();
        return newUserObj.toJSON();
    };

    /**
     * Update user attributes after sanitizing the data. When user data comes
     * from client or 'unsafe' sources, use this method instead of 'set'
     * directly.
     *
     * @param {Partial<UserAttributes>} userData Potentially unsafe userData to set
     * @memberof UserModel
     */
    updateAttributes(userData: { [key: string]: any }) {
        // Don't just set 'rest', not all attributes can be set, just select those that can
        const changedAttribs: Partial<UserAttributes> = {};
        if (userData.permissions && typeof userData.permissions === 'object') {
            changedAttribs.permissions = userData.permissions;
        }
        if (userData.is_admin !== undefined) {
            changedAttribs.is_admin = userData.is_admin === true || userData.is_admin === 'true' ? true : false;
        }
        if (userData.first_name && typeof userData.first_name === 'string') {
            changedAttribs.first_name = userData.first_name;
        }
        if (userData.last_name && typeof userData.last_name === 'string') {
            changedAttribs.last_name = userData.last_name;
        }
        // TODO Update more data as required
        this.set(changedAttribs);
    }

    get tableName() {
        return 'users';
    }

    verifyPassword = async (password: string): Promise<boolean> => {
        if (!this.attributes.password) {
            return false;
        }
        return await bcrypt.compare(password, this.attributes.password);
    };

    getLangPref = (): string | null => {
        const prefs = this.attributes.preferences;
        if (!prefs) {
            return null;
        }
        return prefs.lang || null;
    };

    getDisplayName = (): string => {
        const firstName = this.attributes.first_name;
        const lastName = this.attributes.last_name;
        const username = this.attributes.username;
        const email = this.attributes.email;

        if (firstName && lastName) {
            return firstName + ' ' + lastName;
        }
        if (firstName) {
            return firstName;
        }
        if (lastName) {
            return lastName;
        }
        // Don't greet someone with their email address!
        return username && username !== email ? username : '';
    };

    sanitize = (): BaseUser => {
        return sanitizeUserAttributes(this.attributes);
    };
}
