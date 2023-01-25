/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import bcrypt from 'bcryptjs';
import moment from 'moment';
import { BaseUser } from 'chaire-lib-common/lib/services/user/userType';
import { serializePermissions } from './authorization';
import { getHomePage } from './userPermissions';
import dbQueries from '../../models/db/users.db.queries';
import { UserAttributes } from '../users/user';
import { _emptyStringToNull } from 'chaire-lib-common/lib/utils/LodashExtensions';

export const sanitizeUserAttributes = (attributes: UserAttributes): BaseUser => {
    // TODO: Sign serialized permissions with JWT token or other
    return {
        id: attributes.id,
        username: attributes.username || '',
        email: typeof attributes.email === 'string' ? attributes.email : undefined,
        preferences: attributes.preferences || {},
        firstName: typeof attributes.first_name === 'string' ? attributes.first_name : undefined,
        lastName: typeof attributes.last_name === 'string' ? attributes.last_name : undefined,
        serializedPermissions: serializePermissions(attributes),
        homePage: getHomePage(attributes)
    };
};

export default class UserModel {
    private _attributes: UserAttributes;

    static encryptPassword = (password: string): string => {
        return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    };

    static confirmAccount = async (
        token: string,
        actionCallback?: (user: UserModel) => void
    ): Promise<'Confirmed' | 'NotFound'> => {
        try {
            const userAttribs = await dbQueries.find({ confirmation_token: token });
            if (!userAttribs) {
                return 'NotFound';
            }
            const user = new UserModel(userAttribs);
            await user.updateAndSave({ confirmation_token: null, is_confirmed: true });
            if (actionCallback) {
                actionCallback(user);
            }
            return 'Confirmed';
        } catch (error) {
            return 'NotFound';
        }
    };

    static resetPassword = async (
        resetToken: string,
        newPassword?: string
    ): Promise<'Confirmed' | 'NotFound' | 'Expired' | 'PasswordChanged'> => {
        const userAttribs = await dbQueries.find({ password_reset_token: resetToken });
        if (!userAttribs) {
            return 'NotFound';
        }
        const user = new UserModel(userAttribs);
        if (moment(Date.now()).isAfter(user.attributes.password_reset_expire_at)) {
            return 'Expired';
        }
        if (newPassword) {
            await user.updateAndSave({
                password: UserModel.encryptPassword(newPassword),
                password_reset_token: null,
                password_reset_expire_at: null
            });
            return 'PasswordChanged';
        }
        return 'Confirmed';
    };

    static createAndSave = async (userData: Omit<UserAttributes, 'id' | 'uuid'>): Promise<UserModel> => {
        const userAttribs = await dbQueries.create({
            username: userData.username || null,
            email: userData.email || null,
            google_id: userData.google_id || null,
            facebook_id: userData.facebook_id || null,
            generated_password: userData.generated_password || null,
            password: userData.password || null,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            is_admin: userData.is_admin || false,
            is_valid:
                typeof userData.is_valid === 'boolean' ? userData.is_valid : userData.is_test === true ? false : true,
            is_test: userData.is_test,
            is_confirmed: userData.is_confirmed === false ? false : true,
            confirmation_token: userData.confirmation_token || null
        });
        const user = new UserModel(userAttribs);

        return user;
    };

    static fetchAll = async (): Promise<UserAttributes[]> => dbQueries.collection();

    static find = async (
        findBy: Partial<UserAttributes> & { usernameOrEmail?: string },
        orWhere = false
    ): Promise<UserModel | undefined> => {
        const userAttribs = await dbQueries.find(findBy, orWhere);
        return userAttribs === undefined ? undefined : new UserModel(userAttribs);
    };

    static getByUuid = async (uuid: string): Promise<UserModel | undefined> => {
        const userAttribs = await dbQueries.getByUuid(uuid);
        return userAttribs === undefined ? undefined : new UserModel(userAttribs);
    };

    static getById = async (id: number): Promise<UserModel | undefined> => {
        const userAttribs = await dbQueries.getById(id);
        return userAttribs === undefined ? undefined : new UserModel(userAttribs);
    };

    /** Constructor of the user object. The user MUST exist in the database. To
     * create a new user, use the `UserModel.createAndSave` function */
    constructor(attributes: UserAttributes) {
        this._attributes = attributes;
    }

    get attributes(): UserAttributes {
        return this._attributes;
    }

    /**
     * Update user attributes after sanitizing the data. When user data comes
     * from client or 'unsafe' sources, use this method instead of 'update'
     * directly.
     *
     * @param {Partial<UserAttributes>} userData Potentially unsafe userData to set
     * @memberof UserModel
     */
    async updateAndSanitizeAttributes(userData: { [key: string]: any }) {
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
        return await this.updateAndSave(changedAttribs);
    }

    verifyPassword = async (password: string): Promise<boolean> => {
        if (!this._attributes.password) {
            return false;
        }
        return await bcrypt.compare(password, this._attributes.password);
    };

    getLangPref = (): string | null => {
        const prefs = this._attributes.preferences;
        if (!prefs) {
            return null;
        }
        return prefs.lang || null;
    };

    getDisplayName = (): string => {
        const firstName = this._attributes.first_name;
        const lastName = this._attributes.last_name;
        const username = this._attributes.username;
        const email = this._attributes.email;

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

    /** Update the current user and save update in the database. `id`, `uuid`
     * and `username` fields cannot be updated */
    async updateAndSave(newAttribs: Partial<Omit<UserAttributes, 'id' | 'uuid' | 'username'>>) {
        Object.keys(newAttribs).forEach((key) => {
            this._attributes[key] = newAttribs[key];
        });
        await dbQueries.update(this._attributes.id, newAttribs);
    }

    sanitize = (): BaseUser => {
        return sanitizeUserAttributes(this._attributes);
    };
}
