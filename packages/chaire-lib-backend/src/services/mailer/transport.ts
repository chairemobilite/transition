/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import nodemailer, { Transporter } from 'nodemailer';

const getTransporter = (): Transporter | null => {
    if (process.env.MAIL_TRANSPORT_STRATEGY === 'sendmail') {
        const path = process.env.MAIL_TRANSPORT_SENDMAIL_PATH || '/usr/sbin/sendmail';
        return nodemailer.createTransport({
            sendmail: true,
            newline: 'unix',
            path
        });
    } else if (process.env.MAIL_TRANSPORT_STRATEGY === 'smtp') {
        const host = process.env.MAIL_TRANSPORT_SMTP_HOST;
        const port = process.env.MAIL_TRANSPORT_SMTP_PORT || 587;
        const secure = process.env.MAIL_TRANSPORT_SMTP_SECURE === 'true' ? true : false;
        const user = process.env.MAIL_TRANSPORT_SMTP_AUTH_USER;
        const pass = process.env.MAIL_TRANSPORT_SMTP_AUTH_PWD;
        if (!host || !user || !pass) {
            console.error(
                'SMTP server, user and password must be specified in the .env file. Will not be able to send emails'
            );
            return null;
        }
        return nodemailer.createTransport({
            host,
            port: typeof port === 'string' ? parseInt(port) : port,
            secure,
            auth: {
                user,
                pass
            }
        });
    }
    console.error(
        'Mail transport not properly configured. The server may not be able to send mails.\nSet the environment variables in the .env file. Only sendmail and smtp are supported. Will default to sendmail'
    );
    return nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail'
    });
};

const transporter = getTransporter();
export default transporter;
