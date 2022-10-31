/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import prompt, { RevalidatorSchema } from 'prompt';
import validator from 'validator';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';
import User from '../../services/auth/user';

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

    private validateUsername = (username: string): boolean => {
        return validator.matches(username, /^[a-zA-Z0-9_\-]+$/) && this.existingUsernames.indexOf(username) <= -1;
    };

    private validateEmail = (email: string): boolean => {
        return validator.isEmail(email) && this.existingEmails.indexOf(email) <= -1;
    };

    private callPrompt = async (options: {
        defaultAdmin: boolean;
        defaultValid: boolean;
        defaultConfirmed: boolean;
        preferences: any;
    }): Promise<void> => {
        prompt.start();

        return new Promise((resolve, reject) => {
            const promptSchema = [
                {
                    name: 'username',
                    conform: this.validateUsername,
                    message: 'Username must be composed of digits, letters, underscores or dashes and must be unique.',
                    required: true
                } as RevalidatorSchema,
                {
                    name: 'email',
                    conform: this.validateEmail,
                    message: 'Email is invalid or the email is already used.',
                    required: true
                } as RevalidatorSchema,
                {
                    name: 'password',
                    pattern: /^.{8,}$/,
                    message: 'Password must have at least 8 characters.',
                    hidden: true,
                    required: true,
                    replace: '*'
                } as RevalidatorSchema,
                { name: 'first_name' } as RevalidatorSchema,
                { name: 'last_name' } as RevalidatorSchema,
                {
                    name: 'is_admin',
                    type: 'boolean',
                    default: options.defaultAdmin
                } as RevalidatorSchema,
                {
                    name: 'is_valid',
                    type: 'boolean',
                    default: options.defaultValid
                } as RevalidatorSchema,
                {
                    name: 'is_confirmed',
                    type: 'boolean',
                    default: options.defaultConfirmed
                } as RevalidatorSchema
            ];

            prompt.get(promptSchema, async (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                const user = { ...result, preferences: options.preferences };
                await this.createUser(user);
                resolve();
            });
        });
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

    private async createUser(user: any) {
        console.log('Creating new user: ', user);
        user.password = User.encryptPassword(user.password);
        const newUser = new User(user);
        try {
            await newUser.save();
        } catch (error) {
            console.log(`An error occured when creating the new user: ${error}`);
        }
    }

    public async run(argv: { [key: string]: unknown }): Promise<void> {
        // Handle arguments and default values
        const username = argv['username'];
        const email = argv['email'];
        const password = argv['password'];
        const first_name = argv['first_name'] || '';
        const last_name = argv['last_name'] || '';
        const defaultAdmin = argv['admin'] !== undefined ? (argv['admin'] as boolean) : false;
        const defaultValid = argv['valid'] !== undefined ? (argv['valid'] as boolean) : true;
        const defaultConfirmed = argv['confirmed'] !== undefined ? (argv['confirmed'] as boolean) : true;
        const preferences = typeof argv['prefs'] === 'string' ? JSON.stringify(JSON.parse(argv['prefs'])) : '{}';

        const users = await User.fetchAll();
        this.existingUsernames = users.map((user) => user.attributes.username);
        this.existingEmails = users.map((user) => user.attributes.email);

        if (username || email || password || first_name || last_name) {
            // Non-interactive user creation
            await this.createUserFromData({
                username,
                email,
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
