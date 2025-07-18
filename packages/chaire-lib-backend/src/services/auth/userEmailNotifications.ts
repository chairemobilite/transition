/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import i18n from '../../config/i18next';
import { IUserModel } from './authModel';
import Users from '../users/users';
import mailTransport from '../mailer/transport';
import UserModel from './userAuthModel';

type UserEmailData = {
    email: string;
    displayName: string;
    lang: string | null;
};

interface UserNotification {
    mailText: string | string[];
    mailSubject: string | string[];
    toUser: UserEmailData;
}

export const sendEmail = async (
    userNotification: UserNotification,
    translateKeys: { [name: string]: any }
): Promise<void> => {
    const transport = mailTransport;
    if (transport === null) {
        throw new Error('Mail transport configuration error. Email cannot be sent');
    }
    const urlKeys = Object.keys(translateKeys).filter((key) => translateKeys[key].url);
    const commonTranslateKeys = {
        ...translateKeys,
        name: userNotification.toUser.displayName,
        interpolation: { escapeValue: false }
    };

    const userLang = userNotification.toUser.lang;
    const translate = userLang ? i18n().getFixedT(userLang) : i18n().getFixedT(i18n().language);
    const textTranslateKey = Object.assign({}, commonTranslateKeys);
    urlKeys.forEach((key) => (textTranslateKey[key] = translateKeys[key].url));
    const textMsg = translate(userNotification.mailText, textTranslateKey);

    const htmlTranslateKey = Object.assign({}, commonTranslateKeys);
    urlKeys.forEach(
        (key) => (htmlTranslateKey[key] = `<a href="${translateKeys[key].url}">${translateKeys[key].url}</a>`)
    );
    const htmlMsg = translate(userNotification.mailText, htmlTranslateKey).replace(/\n/g, '<br/>');

    const subject = translate(userNotification.mailSubject);
    const mailOptions = {
        from: process.env.MAIL_FROM_ADDRESS,
        to: userNotification.toUser.email,
        subject: subject,
        text: textMsg,
        html: htmlMsg
    };

    await transport.sendMail(mailOptions);
};

const getConfirmEmailsToSend = async (user: IUserModel, strategy?: string): Promise<UserNotification[]> => {
    const actualStrategy = strategy === 'confirmByAdmin' ? 'confirmByAdmin' : 'confirmByUser';
    const validatedEmail = validateEmailExists(
        user.email,
        `User with display name "${user.displayName}" does not have address to send confirmation email to.`
    );
    if (actualStrategy === 'confirmByUser') {
        return [
            {
                mailText: ['customServer:confirmByUserText', 'server:confirmByUserText'],
                mailSubject: ['customServer:confirmByUserSubject', 'server:confirmByUserSubject'],
                toUser: {
                    email: validatedEmail,
                    displayName: user.displayName,
                    lang: user.langPref
                }
            }
        ];
    }
    const admins = await Users.getAdmins();
    if (admins.length === 0) {
        throw new Error('There are no admins to confirm emails!!');
    }
    // Admins are always from the user auth model, so the object can be constructed directly
    const adminUsers = admins.map((adminAttribs) => new UserModel(adminAttribs));
    // Send email to admins and a notification to the user
    const userNotificationPending = {
        mailText: ['customServer:pendingConfirmByAdminText', 'server:pendingConfirmByAdminText'],
        mailSubject: ['customServer:pendingConfirmByAdminSubject', 'server:pendingConfirmByAdminSubject'],
        toUser: {
            email: validatedEmail,
            displayName: user.displayName,
            lang: user.langPref
        }
    };

    const notifications: UserNotification[] = adminUsers.map((admin) => {
        const validatedAdminEmail = validateEmailExists(
            admin.attributes.email,
            `Admin user with display name "${admin.displayName}" does not have address to send confirmation email to.`
        );
        return {
            mailText: ['customServer:confirmByAdminText', 'server:confirmByAdminText'],
            mailSubject: ['customServer:confirmByAdminSubject', 'server:confirmByAdminSubject'],
            toUser: {
                email: validatedAdminEmail,
                displayName: admin.displayName,
                lang: admin.langPref
            }
        };
    });
    notifications.push(userNotificationPending);
    return notifications;
};

/**
 * Send a welcome email to the user
 * @params user The user who just registered
 */
export const sendWelcomeEmail = async (user: IUserModel): Promise<void> => {
    try {
        const validatedEmail = validateEmailExists(
            user.email,
            `User with display name "${user.displayName}" does not have address to send welcome email to.`
        );
        const email = {
            mailText: ['customServer:welcomeEmailText', 'server:welcomeEmailText'],
            mailSubject: ['customServer:welcomeEmailSubject', 'server:welcomeEmailSubject'],
            toUser: {
                email: validatedEmail,
                displayName: user.displayName,
                lang: user.langPref
            }
        };
        await sendEmail(email, {});
        console.log('Email sent for welcome email');
    } catch (error) {
        console.log('Error sending welcome email: ', error);
        throw error;
    }
};

/**
 * Send confirmation email to the user.s who need to confirm the new user's
 * email
 * @param user The user being confirmed
 * @param options Options: strategy: can be either 'confirmByAdmin' or
 * 'confirmByUser' (default) to determine to whom the confirmation emails will
 * be sent.
 */
export const sendConfirmationEmail = async (
    user: IUserModel,
    options: { strategy?: string; confirmUrl: string }
): Promise<void> => {
    try {
        const emails = await getConfirmEmailsToSend(user, options.strategy);
        await Promise.all(
            emails.map((email) =>
                sendEmail(email, {
                    userConfirmationUrl: { url: options.confirmUrl },
                    usermail: user.email
                })
            )
        );
        console.log(`${emails.length} email(s) (admin and/or user) sent for account confirmation`);
    } catch (error) {
        console.log('Error sending confirmation email: ', error);
        throw error;
    }
};

export const sendConfirmedByAdminEmail = async (user: IUserModel): Promise<void> => {
    try {
        const validatedEmail = validateEmailExists(
            user.email,
            `User with display name "${user.displayName}" does not have address to send confirmation by admin email to.`
        );
        const email = {
            mailText: ['customServer:confirmedByAdminEmailText', 'server:confirmedByAdminEmailText'],
            mailSubject: ['customServer:confirmedByAdminEmailSubject', 'server:confirmedByAdminEmailSubject'],
            toUser: {
                email: validatedEmail,
                displayName: user.displayName,
                lang: user.langPref
            }
        };
        await sendEmail(email, {});
        console.log('Email sent for confirmation by admin');
    } catch (error) {
        console.log('Error sending confirmation by admin email: ', error);
        throw error;
    }
};

/**
 * Send an email to the user with a link to the forget password page
 * @param user The user who forgot his password
 * @param options Options
 */
export const resetPasswordEmail = async (user: IUserModel, options: { resetPasswordUrl: string }): Promise<void> => {
    try {
        const validatedEmail = validateEmailExists(
            user.email,
            `User with display name "${user.displayName}" does not have address to send reset password email to.`
        );
        const email = {
            mailText: ['customServer:resetPasswordEmailText', 'server:resetPasswordEmailText'],
            mailSubject: ['customServer:resetPasswordEmailSubject', 'server:resetPasswordEmailSubject'],
            toUser: {
                email: validatedEmail,
                displayName: user.displayName,
                lang: user.langPref
            }
        };
        await sendEmail(email, { resetPasswordUrl: { url: options.resetPasswordUrl } });
        console.log('Email sent for password reset');
    } catch (error) {
        console.log('Error sending password reset email: ', error);
        throw error;
    }
};

export const validateEmailExists = (email: string | null | undefined, errorMessage: string): string => {
    if (typeof email !== 'string' || email.length === 0) {
        throw new Error(errorMessage);
    }

    return email;
};
