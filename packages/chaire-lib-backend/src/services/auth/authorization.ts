/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { NextFunction, Request, Response } from 'express';
import defineAbilitiesFor from './userPermissions';
import { PackRule, packRules } from '@casl/ability/extra';
import { UserAttributes } from '../users/user';

export const UserSubject = 'Users';

/**
 * Simple authorization middleware for apps. It should be used to test for
 * permissions for all elements of a given key. If permissions are to be
 * verified on a specific subject (one instance of a subject type), other custom
 * authorization should be checked to pass the subject
 *
 * Not that if permissions are defined such that object fields are validated, if
 * checking with only the global subject type, the permissions will be true. Say
 * the user can update only data with their user ID `can('update', 'Users', {
 * id: user.id })`, then checking 'update' permissions for 'Users' without
 * subject will still be true.
 *
 * @param {{ [key: string ]: string}} permissions An object with the permissions
 * to verify, the keys are the subject types and the values are the permissions
 * to authorize. For example, to get the method to validate if a user can 'read'
 * or 'update' subject of type 'Users', the permissions to send would be {Users:
 * ['read', 'update'] }
 */
const isAuthorized = (permissions: { [key: string]: string | string[] }) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            if (req.user) {
                // TODO Carry the user permissions with the user object, or with other authorization token
                const userPermissions = defineAbilitiesFor(req.user as UserAttributes);
                // Check if the user has required permission, admin is a special case [for now]
                const permissionSubjects = Object.keys(permissions);
                for (let i = 0; i < permissionSubjects.length; i++) {
                    const subject = permissionSubjects[i];
                    const perms =
                        typeof permissions[subject] === 'string'
                            ? ([permissions[subject]] as string[])
                            : (permissions[subject] as string[]);
                    const cant = perms.find((perm) => !userPermissions.can(perm, subject));
                    if (cant) {
                        throw `User cannot ${cant} on subject ${subject}`;
                    }
                }
                next();
            } else {
                throw 'not logged in';
            }
        } catch (error) {
            console.error('Unauthorized access: ', error);
            res.status(401).json({ status: 'Unauthorized' });
        }
    };
};

/** Express middleware to verify if user is administrator */
export const isAdmin = isAuthorized({ all: 'manage' });

/** Express middleware to verify if user is logged in */
export const isLoggedIn = (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
        next();
    } else {
        console.error('User not logged in');
        res.status(401).json({ status: 'Unauthorized' });
    }
};

// TODO Type the rule type in PackRule
export const serializePermissions = (user: UserAttributes): PackRule<any>[] => {
    const userPermissions = defineAbilitiesFor(user);
    return packRules(userPermissions.rules);
};

export default isAuthorized;
