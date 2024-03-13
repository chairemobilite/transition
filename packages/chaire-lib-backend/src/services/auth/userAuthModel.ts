/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BaseUser } from 'chaire-lib-common/lib/services/user/userType';
import { serializePermissions } from './authorization';
import { getHomePage } from './userPermissions';
import dbQueries from '../../models/db/users.db.queries';
import { UserAttributes } from '../users/user';
import { AuthModelBase, NewUserParams, UserModelBase } from './authModel';

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

class UserAuthModel extends AuthModelBase<UserModel> {
    constructor() {
        super(dbQueries);
    }

    createAndSave = async (userData: NewUserParams & { is_admin?: boolean }): Promise<UserModel> => {
        const userAttribs = await dbQueries.create({
            username: userData.username || null,
            email: userData.email || null,
            google_id: userData.googleId || null,
            facebook_id: userData.facebookId || null,
            generated_password: userData.generatedPassword || null,
            password:
                userData.googleId || userData.facebookId || !userData.password
                    ? null
                    : this.encryptPassword(userData.password),
            first_name: userData.firstName || '',
            last_name: userData.lastName || '',
            is_valid: userData.isTest === true ? false : true,
            is_confirmed: userData.confirmationToken !== undefined ? false : true,
            confirmation_token: userData.confirmationToken !== undefined ? userData.confirmationToken : null,
            is_admin: userData.is_admin === true,
            is_test: userData.isTest === true,
            preferences: typeof userData.preferences === 'object' ? userData.preferences : null
        });
        const user = this.newUser(userAttribs);

        return user;
    };

    fetchAll = async (): Promise<UserAttributes[]> => dbQueries.collection();

    getByUuid = async (uuid: string): Promise<UserModel | undefined> => {
        const userAttribs = await dbQueries.getByUuid(uuid);
        return userAttribs === undefined ? undefined : new UserModel(userAttribs);
    };

    newUser = (userData: unknown) => new UserModel(userData as UserAttributes);
}

export const userAuthModel = new UserAuthModel();

export default class UserModel extends UserModelBase {
    /** Constructor of the user object. The user MUST exist in the database. To
     * create a new user, use the `UserModel.createAndSave` function */
    constructor(_attributes: UserAttributes) {
        super(_attributes);
    }

    get attributes(): UserAttributes {
        return super.attributes as UserAttributes;
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

    /** Update the current user and save update in the database. `id`, `uuid`
     * and `username` fields cannot be updated */
    async updateAndSave(newAttribs: Partial<Omit<UserAttributes, 'id' | 'uuid' | 'username'>>) {
        Object.keys(newAttribs).forEach((key) => {
            this.attributes[key] = newAttribs[key];
        });
        await dbQueries.update(this.attributes.id, newAttribs);
    }

    sanitize = (): BaseUser => {
        return sanitizeUserAttributes(this.attributes);
    };

    recordLogin = async (): Promise<void> => {
        // Record current datetime as login
        dbQueries.setLastLogin(this.attributes.id);
    };
}
