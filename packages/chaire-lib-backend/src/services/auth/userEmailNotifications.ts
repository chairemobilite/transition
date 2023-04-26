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
    id: number;
    email: string | null | undefined;
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
    if (typeof userNotification.toUser.email !== 'string') {
        console.error(`Mail should be sent to user ${userNotification.toUser.id}, but the user does not have an email`);
        return;
    }
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
    if (actualStrategy === 'confirmByUser') {
        return [
            {
                mailText: 'server:confirmByUserText',
                mailSubject: 'server:confirmByUserSubject',
                toUser: {
                    id: user.id,
                    email: user.email,
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
        mailText: 'server:pendingConfirmByAdminText',
        mailSubject: 'server:pendingConfirmByAdminSubject',
        toUser: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            lang: user.langPref
        }
    };
    const notifications: UserNotification[] = adminUsers.map((admin) => ({
        mailText: 'server:confirmByAdminText',
        mailSubject: 'server:confirmByAdminSubject',
        toUser: {
            id: admin.attributes.id,
            email: admin.attributes.email,
            displayName: admin.displayName,
            lang: admin.langPref
        }
    }));
    notifications.push(userNotificationPending);
    return notifications;
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
    const emails = await getConfirmEmailsToSend(user, options.strategy);
    emails.forEach(async (email) => {
        await sendEmail(email, { userConfirmationUrl: { url: options.confirmUrl }, usermail: user.email });
    });
    console.log('Email sent for account confirmation');
};

export const sendConfirmedByAdminEmail = async (user: IUserModel): Promise<void> => {
    const email = {
        mailText: 'server:confirmedByAdminEmailText',
        mailSubject: 'server:confirmedByAdminEmailSubject',
        toUser: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            lang: user.langPref
        }
    };
    await sendEmail(email, {});
    console.log('Email sent for confirmation by admin');
};

/**
 * Send an email to the user with a link to the forget password page
 * @param user The user who forgot his password
 * @param options Options
 */
export const resetPasswordEmail = async (user: IUserModel, options: { resetPasswordUrl: string }): Promise<void> => {
    const email = {
        mailText: 'server:resetPasswordEmailText',
        mailSubject: 'server:resetPasswordEmailSubject',
        toUser: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            lang: user.langPref
        }
    };
    await sendEmail(email, { resetPasswordUrl: { url: options.resetPasswordUrl } });
    console.log('Email sent for password reset');
};
