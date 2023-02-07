/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import inquirer from 'inquirer';
import validator from 'validator';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';
import User from '../../services/auth/user';
import { UserAttributes } from '../../services/users/user';

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
        defaultValid: boolean;
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
                name: 'is_valid',
                type: 'confirm',
                default: options.defaultValid
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

    private async createUserFromData(user: any) {
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
        if (!this.validateUsername(user.username)) {
            console.error('Invalid or existing username');
            return;
        }
        if (!this.validateEmail(user.email)) {
            console.error('Invalid or existing email');
            return;
        }
        await this.createUser(user);
    }

    private async createUser(user: UserAttributes) {
        console.log('Creating new user: ', user);
        user.password = typeof user.password === 'string' ? User.encryptPassword(user.password) : undefined;
        try {
            await User.createAndSave(user);
        } catch (error) {
            console.log(`An error occured when creating the new user: ${error}`);
        }
    }

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        // Handle arguments and default values
        const username = argv['username'];
        const email = argv['email'] !== undefined ? argv['email'] as string : undefined;
        const password = argv['password'];
        const first_name = argv['first_name'] || '';
        const last_name = argv['last_name'] || '';
        const defaultAdmin = argv['admin'] !== undefined ? (argv['admin'] as boolean) : false;
        const defaultValid = argv['valid'] !== undefined ? (argv['valid'] as boolean) : true;
        const defaultConfirmed = argv['confirmed'] !== undefined ? (argv['confirmed'] as boolean) : true;
        const preferences = typeof argv['prefs'] === 'string' ? JSON.stringify(JSON.parse(argv['prefs'])) : '{}';

        const users = await User.fetchAll();
        this.existingUsernames = users
            .filter((user) => typeof user.username === 'string')
            .map((user) => user.username) as string[];
        this.existingEmails = users
            .filter((user) => typeof user.email === 'string')
            .map((user) => user.email?.toLowerCase()) as string[];

        if (username || email || password || first_name || last_name) {
            // Non-interactive user creation
            await this.createUserFromData({
                username,
                email: email?.toLowerCase(),
                password,
                first_name,
                last_name,
                is_admin: defaultAdmin,
                is_valid: defaultValid,
                is_confirmed: defaultConfirmed,
                preferences
            });
        } else {
            await this.callPrompt({ defaultAdmin, defaultValid, defaultConfirmed, preferences });
        }
    }
}
