/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';
import validator from 'validator';
import _cloneDeep from 'lodash.clonedeep';

import { _isBlank, _toBool } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';
import { userAuthModel } from '../../services/auth/userAuthModel';
import { NewUserParams } from '../../services/auth/authModel';
import { v4 as uuidV4 } from 'uuid';

/**
 * Task to create a user in the database. If any of the username, email or
 * password options are set, then it will not prompt the user for any other data
 * and it will simply return any invalid data.
 *
 * task options are:
 *
 * * --username: The name of the user
 * * --email: The email for the user
 * * --password: The password for the user
 * * --first_name: The new user's first name (optional)
 * * --last_name: The new user's last name (optional)
 * * --[no-]admin: Whether the new user should be administrator (default: false)
 * * --[no-]valid: Whether the new user is valid (default: true)
 * * --[no-]confirmed: Whether the new user is confirmed (default: true)
 * * --prefs: Json string with default preferences for the user, for example:
 *   '{ "lang": "fr" }'
 *
 * @export
 * @class CreateUser
 * @implements {GenericTask}
 */
export class CreateUser implements GenericTask {
    private existingEmails: string[] = [];
    private existingUsernames: string[] = [];

    private validateUsername = (username: string): boolean | string =>
        validator.matches(username, /^[a-zA-Z0-9_\-]+$/) && this.existingUsernames.indexOf(username) <= -1
            ? true
            : 'Username must be composed of digits, letters, underscores or dashes and must be unique.';

    private validateEmail = (email: string): boolean | string =>
        validator.isEmail(email) && this.existingEmails.indexOf(email) <= -1
            ? true
            : 'Email is invalid or the email is already used.';

    private callPrompt = async (options: {
        defaultAdmin: boolean;
        defaultConfirmed: boolean;
        preferences: any;
    }): Promise<void> => {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'username',
                message: 'username',
                validate: this.validateUsername
            },
            {
                type: 'input',
                name: 'email',
                message: 'email',
                validate: this.validateEmail
            },
            {
                type: 'password',
                name: 'password',
                message: 'password',
                validate: (pwd: string) =>
                    pwd.match(/^.{8,}$/) !== null ? true : 'Password must have at least 8 characters.'
            },
            {
                type: 'input',
                name: 'first_name',
                default: ''
            },
            {
                type: 'input',
                name: 'last_name',
                default: ''
            },
            {
                name: 'is_admin',
                type: 'confirm',
                default: options.defaultAdmin
            },
            {
                name: 'is_confirmed',
                type: 'confirm',
                default: options.defaultConfirmed
            }
        ]);

        const user = { ...answers, preferences: options.preferences };
        await this.createUser(user);
    };

    private async createUserFromData(user: NewUserParams & { is_admin?: boolean }) {
        let isValid = true;
        if (_isBlank(user.email)) {
            isValid = false;
            console.error('Email is required, use the --email parameter');
        }
        if (_isBlank(user.username)) {
            if (user.email) {
                user.username = user.email;
            } else {
                isValid = false;
                console.error('Username (or email) is required, use the --username parameter');
            }
        }
        if (_isBlank(user.password)) {
            isValid = false;
            console.error('Password is required, use the --password parameter');
        }
        if (!isValid) {
            throw new Error(
                'Missing arguments to create a user. Mandatory arguments: --email <email address> --password <password> [--username <username>]'
            );
        }
        // Just write an error message if username or email does not validate, it's not an error to throw
        if (typeof user.username === 'string' && this.validateUsername(user.username) !== true) {
            console.error('Invalid or existing username:', this.validateUsername(user.username));
            return;
        }
        if (typeof user.email === 'string' && this.validateEmail(user.email) !== true) {
            console.error('Invalid or existing email:', this.validateEmail(user.email));
            return;
        }
        await this.createUser(user);
    }

    private async createUser(user: NewUserParams & { is_admin?: boolean }) {
        // hide password from confirmation object log:
        const confirmationUser = _cloneDeep(user);
        confirmationUser.password = '***';
        console.log('Creating new user: ', confirmationUser);
        try {
            await userAuthModel.createAndSave(user as NewUserParams);
        } catch (error) {
            console.log(`An error occured when creating the new user: ${error}`);
        }
    }

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        // Handle arguments and default values
        const username = argv['username'] !== undefined ? (argv['username'] as string) : undefined;
        const email = argv['email'] !== undefined ? (argv['email'] as string) : undefined;
        const password = argv['password'] !== undefined ? (argv['password'] as string) : undefined;
        const firstName = argv['first_name'] !== undefined ? (argv['first_name'] as string) : '';
        const lastName = argv['last_name'] !== undefined ? (argv['last_name'] as string) : '';
        const defaultAdmin = _toBool(argv['admin'] as any, false) as boolean;
        const defaultConfirmed = _toBool(argv['confirmed'] as boolean, true) as boolean;
        const preferences = typeof argv['prefs'] === 'string' ? JSON.parse(argv['prefs']) : {};

        const users = await userAuthModel.fetchAll();
        this.existingUsernames = users
            .filter((user) => typeof user.username === 'string')
            .map((user) => user.username) as string[];
        this.existingEmails = users
            .filter((user) => typeof user.email === 'string')
            .map((user) => user.email) as string[];

        if (username || email || password || firstName || lastName) {
            // Non-interactive user creation
            await this.createUserFromData({
                username,
                email,
                password,
                firstName,
                lastName,
                is_admin: defaultAdmin,
                confirmationToken: defaultConfirmed !== true ? uuidV4() : undefined,
                preferences
            });
        } else {
            await this.callPrompt({ defaultAdmin, defaultConfirmed, preferences });
        }
    }
}
