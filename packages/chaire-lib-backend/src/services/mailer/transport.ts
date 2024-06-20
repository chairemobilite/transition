/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import nodemailer, { Transporter } from 'nodemailer';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import fs from 'fs';
import DKIM from 'nodemailer/lib/dkim';

// Generate the config block for DKIM (DomainKeys Identified Mail) if the right ENV variables are defined
// DKIM allow to sign each sent email based on a key pair stored in DNS config
const getDkimConfig = (): DKIM.Options | undefined => {
    // Only use DKIM if we define the env variable for the SELECTOR
    // We also need the information for the domain and the private key
    if (!_isBlank(process.env.MAIL_TRANSPORT_DKIM_SELECTOR)) {
        const dkimSelector = process.env.MAIL_TRANSPORT_DKIM_SELECTOR || '';
        const dkimDomain = process.env.MAIL_TRANSPORT_DKIM_DOMAIN;
        if (!dkimDomain) {
            console.error('Missing DKIM domain');
            return undefined;
        }
        const privateKeyPath = process.env.MAIL_TRANSPORT_DKIM_PRIVATE_PATH || '';
        if (!fs.existsSync(privateKeyPath)) {
            console.error(`Invalid DKIM Private key file path (${privateKeyPath})`);
            return undefined;
        }
        const dkimPrivateKey = fs.readFileSync(privateKeyPath, 'utf-8');
        if (!dkimPrivateKey) {
            console.error('Missing DKIM Private key');
            return undefined;
        }
        return {
            domainName: dkimDomain,
            keySelector: dkimSelector,
            privateKey: dkimPrivateKey
        };
    }
    return undefined;
};

const getTransporter = (): Transporter | null => {
    if (process.env.MAIL_TRANSPORT_STRATEGY === 'sendmail') {
        const path = process.env.MAIL_TRANSPORT_SENDMAIL_PATH || '/usr/sbin/sendmail';
        return nodemailer.createTransport({
            sendmail: true,
            newline: 'unix',
            path,
            dkim: getDkimConfig()
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
            },
            dkim: getDkimConfig()
        });
    }
    console.error(
        'Mail transport not properly configured. The server may not be able to send mails.\nSet the environment variables in the .env file. Only sendmail and smtp are supported. Will default to sendmail'
    );
    //TODO We could merge this default createTransport with the sendmail one at the beginning
    return nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail'
    });
};

const transporter = getTransporter();
export default transporter;
