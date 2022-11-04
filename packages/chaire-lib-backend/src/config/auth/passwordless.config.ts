/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { PassportStatic } from 'passport';
import url from 'url';
import MagicLoginStrategy from 'passport-magic-login';
import MagicWithDirectSignup from '../../services/auth/pwdLessDirectSignupStrategy';
import { sendEmail } from '../../services/auth/userEmailNotifications';
import UserModel from '../../services/auth/user';
import { saveNewUser } from './passport.utils';

// MagicLoginStrategy sends a link even for registration, for first-time users.
// Since we also want to support direct entry to the app for first-time users,
// we use a custom MagicWithDirectSignup strategy when the user enters his data

const getMagicUrl = (href: string): string => {
    const host = process.env.HOST || 'http://localhost:8080';
    return new url.URL(`${href}`, host).href;
};

const sendMagicLink = async (destination, href: string) => {
    const model = await new UserModel()
        .query({
            where: { email: destination }
        })
        .fetch({ require: false });
    const user = model === undefined ? new UserModel({ email: destination }) : model;
    sendEmail(
        {
            mailText: ['customServer:magicLinkEmailText', 'server:magicLinkEmailText'],
            mailSubject: ['customServer:magicLinkEmailSubject', 'server:magicLinkEmailSubject'],
            toUser: user
        },
        { magicLinkUrl: { url: getMagicUrl(href) } }
    )
        .then(() => {
            console.log('Email sent for magic link authentication');
        })
        .catch((error) => {
            console.error('Error sending magic email: ', error);
        });
};

const getOrCreateUserWithEmail = async (destination: string): Promise<UserModel> => {
    console.log('destination', destination);
    const model = await new UserModel()
        .query({
            where: { email: destination }
        })
        .fetch({ require: false });
    if (model !== null) {
        return model;
    }
    const isTest =
        destination.toLowerCase().endsWith('@test.com') ||
        destination.toLowerCase().endsWith('@test') ||
        destination.toLowerCase().endsWith('@test.test');
    const newUser = await saveNewUser({
        username: destination,
        email: destination,
        isTest
    });
    if (newUser !== null) {
        return newUser;
    } else {
        throw 'Cannot save new user';
    }
};

export default function(passport: PassportStatic) {
    // TODO Manage the language
    const magicLogin = new MagicLoginStrategy({
        // Used to encrypt the authentication token. Needs to be long, unique and (duh) secret.
        secret: process.env.MAGIC_LINK_SECRET_KEY as string,

        // The authentication callback URL
        callbackUrl: '/magic/verify',

        // Called with the generated magic link so you can send it to the user
        // "destination" is what you POST-ed from the client
        // "href" is your confirmUrl with the confirmation token,
        // for example "/auth/magiclogin/confirm?token=<longtoken>"
        sendMagicLink,

        // Once the user clicks on the magic link and verifies their login attempt,
        // you have to match their email to a user record in the database.
        // If it doesn't exist yet they are trying to sign up so you have to create a new one.
        // "payload" contains { "destination": "email" }
        // In standard passport fashion, call callback with the error as the first argument (if there was one)
        // and the user data as the second argument!
        verify: async (payload, done) => {
            // Get or create a user with the provided email from the database
            try {
                if (payload.destination === undefined) {
                    throw 'Invalid token, no email address';
                }
                const user = await getOrCreateUserWithEmail(payload.destination);
                done(undefined, user.sanitize(), { referrer: payload.referrer });
            } catch (err) {
                done(typeof err === 'string' ? new Error(err) : (err as Error), undefined);
            }
        }
    });

    const directSignupStrategy = new MagicWithDirectSignup(magicLogin);
    passport.use('passwordless-login', magicLogin);
    passport.use('passwordless-enter-login', directSignupStrategy);
}
