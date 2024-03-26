/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import moment, { Moment } from 'moment';
import bcrypt from 'bcryptjs';

import { BaseUser } from 'chaire-lib-common/lib/services/user/userType';
import { UserAttributesBase } from '../users/user';

export interface IUserModel {
    id: number;
    email: string | null;
    langPref: string | null;
    displayName: string;
    passwordResetExpireAt?: Moment | null;
    confirmationToken: string | null;
    isConfirmed: boolean;
    /** Get the user attributes for this user, used in backend applications.
     * Implementations can add data to these attributes */
    attributes: UserAttributesBase;
    /** Function that returns a base user with no confidential information. This
     * user may be seen by the client */
    sanitize: () => BaseUser;
    verifyPassword: (password: string) => Promise<boolean>;
    updateAndSave(newAttribs: unknown): Promise<void>;
    /**
     * Function called when the user has just logged in the application.
     */
    recordLogin: () => Promise<void>;
}

export type NewUserParams = {
    username?: string;
    email?: string;
    /** Unencrypted generated password, the authentication model should take care to save it as expected */
    generatedPassword?: string;
    googleId?: string;
    facebookId?: string;
    /** Unencrypted password, the authentication model should take care to save it as expected */
    password?: string;
    isTest?: boolean;
    confirmationToken?: string;
    firstName?: string;
    lastName?: string;
    preferences?: { [key: string]: any };
};

export interface IAuthModel<U extends IUserModel> {
    encryptPassword: (password: string) => string;

    confirmAccount: (token: string, actionCallback?: (user: U) => void) => Promise<'Confirmed' | 'NotFound'>;

    resetPassword: (
        resetToken: string,
        newPassword?: string
    ) => Promise<'Confirmed' | 'NotFound' | 'Expired' | 'PasswordChanged'>;

    createAndSave: (userData: NewUserParams) => Promise<U>;

    /**
     * Finds a user by various fields
     *
     * @param findBy The attributes by which to find the user
     * @param orWhere If there are more than one findBy attribute, whether they
     * should all be as specified or only one
     * @returns A single user object if found, or `undefined` if the user with
     * those attributes does not exist
     */
    find: (
        findBy: {
            usernameOrEmail?: string;
            confirmation_token?: string;
            username?: string;
            email?: string;
            google_id?: string;
            facebook_id?: string;
        },
        orWhere?: boolean
    ) => Promise<U | undefined>;

    getById: (id: number) => Promise<U | undefined>;

    newUser: (userData: unknown) => U;
}

export abstract class AuthModelBase<U extends UserModelBase> implements IAuthModel<U> {
    constructor(
        private dbQueries: {
            find: (
                findBy: Partial<UserAttributesBase> & { usernameOrEmail?: string },
                orWhere?: boolean
            ) => unknown | undefined;
            getById: (id: number) => unknown | undefined;
        }
    ) {
        // Nothing to do
    }

    encryptPassword = (password: string): string => {
        return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    };

    confirmAccount = async (token: string, actionCallback?: (user: U) => void): Promise<'Confirmed' | 'NotFound'> => {
        try {
            const userAttribs = await this.dbQueries.find({ confirmation_token: token });
            if (!userAttribs) {
                return 'NotFound';
            }
            const user = this.newUser(userAttribs);
            await user.updateAndSave({ confirmation_token: null, is_confirmed: true });
            if (actionCallback) {
                actionCallback(user);
            }
            return 'Confirmed';
        } catch (error) {
            return 'NotFound';
        }
    };

    resetPassword = async (
        resetToken: string,
        newPassword?: string
    ): Promise<'Confirmed' | 'NotFound' | 'Expired' | 'PasswordChanged'> => {
        const userAttribs = await this.dbQueries.find({ password_reset_token: resetToken });
        if (!userAttribs) {
            return 'NotFound';
        }
        const user = this.newUser(userAttribs);
        if (moment(Date.now()).isAfter(user.passwordResetExpireAt)) {
            return 'Expired';
        }
        if (newPassword) {
            await user.updateAndSave({
                password: this.encryptPassword(newPassword),
                password_reset_token: null,
                password_reset_expire_at: null
            });
            return 'PasswordChanged';
        }
        return 'Confirmed';
    };

    abstract createAndSave(userData: NewUserParams): Promise<U>;

    find = async (
        findBy: Partial<UserAttributesBase> & { usernameOrEmail?: string },
        orWhere = false
    ): Promise<U | undefined> => {
        const userAttribs = await this.dbQueries.find(findBy, orWhere);
        return userAttribs === undefined ? undefined : this.newUser(userAttribs);
    };

    getById = async (id: number): Promise<U | undefined> => {
        const userAttribs = await this.dbQueries.getById(id);
        return userAttribs === undefined ? undefined : this.newUser(userAttribs);
    };

    abstract newUser(userData: unknown): U;
}

export abstract class UserModelBase implements IUserModel {
    /** Constructor of the user object. The user MUST exist in the database. To
     * create a new user, use the `UserModel.createAndSave` function */
    constructor(private _attributes: UserAttributesBase) {
        // Nothing to do
    }

    get attributes(): UserAttributesBase {
        return this._attributes;
    }

    verifyPassword = async (password: string): Promise<boolean> => {
        if (!this.attributes.password) {
            return false;
        }
        return await bcrypt.compare(password, this.attributes.password);
    };

    /**
     * Update user attributes after sanitizing the data. When user data comes
     * from client or 'unsafe' sources, use this method instead of 'update'
     * directly.
     *
     * @param {Partial<UserAttributesBase>} userData Potentially unsafe userData to set
     * @memberof UserModel
     */
    abstract updateAndSanitizeAttributes(userData: { [key: string]: any }): Promise<void>;

    /** Update the current user and save update in the database. `id`, `uuid`
     * and `username` fields cannot be updated */
    abstract updateAndSave(newAttribs: Partial<Omit<UserAttributesBase, 'id' | 'username'>>): Promise<void>;

    recordLogin = async (): Promise<void> => {
        // By default, do nothing
    };

    get id(): number {
        return this.attributes.id;
    }

    get langPref(): string | null {
        const prefs = this.attributes.preferences;
        if (!prefs) {
            return null;
        }
        return prefs.lang || null;
    }

    get email(): string | null {
        return this.attributes.email || null;
    }

    get passwordResetExpireAt(): Moment | null | undefined {
        return this.attributes.password_reset_expire_at;
    }

    get confirmationToken(): string | null {
        return this.attributes.confirmation_token || null;
    }

    get isConfirmed(): boolean {
        return this.attributes.is_confirmed === true;
    }

    get displayName(): string {
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
    }

    abstract sanitize(): BaseUser;
}
