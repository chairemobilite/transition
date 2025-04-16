/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Transporter } from 'nodemailer';
import nodemailerMock  from 'nodemailer-mock';
import { v4 as uuidV4 } from 'uuid';

import { sendConfirmationEmail, sendConfirmedByAdminEmail, resetPasswordEmail, sendEmail, validateEmailExists } from '../userEmailNotifications';
import UserModel from '../userAuthModel';
import { registerTranslationDir } from '../../../config/i18next';
import usersDbQueries from '../../../models/db/users.db.queries';

registerTranslationDir(__dirname + '/../../../../../../locales/');

// Need to mock the db to fetch admins
jest.mock('../../../models/db/users.db.queries', () => ({
    getList: jest.fn()
}));
const mockGetList = usersDbQueries.getList as jest.MockedFunction<typeof usersDbQueries.getList>;
// Mock email transport
jest.mock('../../mailer/transport', () => (nodemailerMock.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail'
}) as any as Transporter));

const fromEmail = 'test@admin.org';
process.env.MAIL_FROM_ADDRESS = fromEmail;

// User data: 2 admins for each language and the user himself
const defaultUserData = {
    id: 5,
    uuid: uuidV4(),
    email: 'test@transition.city',
    preferences: { lang: 'fr' }
};
const frenchAdmin = {
    id: 1,
    uuid: uuidV4(),
    email: 'french@transition.city',
    username: 'frenchAdmin',
    first_name: 'French',
    last_name: 'Admin',
    preferences: { lang: 'fr' }
};
const englishAdmin = {
    id: 2,
    uuid: uuidV4(),
    email: 'english@transition.city',
    username: 'englishAdmin',
    preferences: { lang: 'en' }
};

const confirmUrl = 'http://transition.city/verify/something';

beforeEach(() => {
    nodemailerMock.mock.reset();
    mockGetList.mockClear();
    mockGetList.mockResolvedValue({ users: [frenchAdmin, englishAdmin], totalCount: 2 });
});

test('Test sending with defaults', async () => {
    const user = new UserModel({ ...defaultUserData });
    await sendConfirmationEmail(user, { confirmUrl });
    const sentEmails = nodemailerMock.mock.getSentMail();
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].from).toEqual(fromEmail);
    expect(sentEmails[0].to).toEqual(defaultUserData.email);
    expect(sentEmails[0].subject).toBeDefined();
    expect(sentEmails[0].text).toBeDefined();

});

test('Test sending with various languages', async () => {
    const frenchUser = new UserModel({ ...defaultUserData, preferences: { lang: 'fr' } });
    await sendConfirmationEmail(frenchUser, { confirmUrl });
    const englishUser = new UserModel({ ...defaultUserData, preferences: { lang: 'en' } });
    await sendConfirmationEmail(englishUser, { confirmUrl });

    const sentEmails = nodemailerMock.mock.getSentMail();
    expect(sentEmails.length).toBe(2);
    expect(sentEmails[0].from).toEqual(fromEmail);
    expect(sentEmails[0].to).toEqual(defaultUserData.email);
    expect(sentEmails[0].subject).not.toEqual(sentEmails[1].subject);
    expect(sentEmails[0].text).not.toEqual(sentEmails[1].text);
    expect(sentEmails[0].text).toContain('Bonjour');
    expect(sentEmails[1].text).toContain('Hi');
});

test('Registration email confirm by admin', async () => {
    const user = new UserModel({ ...defaultUserData });
    await sendConfirmationEmail(user, { strategy: 'confirmByAdmin', confirmUrl });

    const sentEmails = nodemailerMock.mock.getSentMail();
    expect(sentEmails.length).toBe(3);
    expect(sentEmails[0].from).toEqual(fromEmail);
    expect(sentEmails[0].to).toEqual(frenchAdmin.email);
    expect(sentEmails[1].from).toEqual(fromEmail);
    expect(sentEmails[1].to).toEqual(englishAdmin.email);
    expect(sentEmails[2].from).toEqual(fromEmail);
    expect(sentEmails[2].to).toEqual(defaultUserData.email);
    expect(sentEmails[0].subject).not.toEqual(sentEmails[1].subject);
    expect(sentEmails[0].text).not.toEqual(sentEmails[1].text);
    expect(sentEmails[0].text).toContain('Bonjour ' + frenchAdmin.first_name + ' ' + frenchAdmin.last_name);
    expect(sentEmails[1].text).toContain('Hi ' + englishAdmin.username);
    expect(sentEmails[1].text).toContain(confirmUrl);
    expect(sentEmails[1].text).toContain('\n');
    expect(sentEmails[0].html).not.toEqual(sentEmails[1].html);
    expect(sentEmails[0].html).toContain('Bonjour ' + frenchAdmin.first_name + ' ' + frenchAdmin.last_name);
    expect(sentEmails[1].html).toContain('Hi ' + englishAdmin.username);
    expect(sentEmails[1].html).toContain(`<a href="${confirmUrl}">${confirmUrl}</a>`);
    expect((sentEmails[0].html as any).match(/\<br\/\>/g).length).toBeGreaterThan(1);
    expect(sentEmails[2].text).toContain('Bonjour');
    expect(sentEmails[2].text).not.toContain(confirmUrl);

});

test('Registration email confirm by admin, but no admin', async () => {
    mockGetList.mockResolvedValueOnce({ users: [], totalCount: 0 });
    const user = new UserModel({ ...defaultUserData });
    await expect(sendConfirmationEmail(user, { strategy: 'confirmByAdmin', confirmUrl }))
        .rejects
        .toEqual(new Error('There are no admins to confirm emails!!'));
    expect(mockGetList).toHaveBeenCalledTimes(1);
    expect(mockGetList).toHaveBeenCalledWith({ filters: { is_admin: true } });
});

test('Forgot password email, french', async () => {
    const user = new UserModel({ ...defaultUserData });
    await resetPasswordEmail(user, { resetPasswordUrl: confirmUrl });

    const sentEmails = nodemailerMock.mock.getSentMail();
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].from).toEqual(fromEmail);
    expect(sentEmails[0].to).toEqual(defaultUserData.email);
    expect(sentEmails[0].subject).toContain('Mot de passe oublié');
    expect(sentEmails[0].text).toContain('Bonjour ');
    expect(sentEmails[0].text).toContain(confirmUrl);
    expect(sentEmails[0].text).toContain('\n');
    expect(sentEmails[0].html).toContain('Bonjour ');
    expect(sentEmails[0].html).toContain(`<a href="${confirmUrl}">${confirmUrl}</a>`);
    expect((sentEmails[0].html as any).match(/\<br\/\>/g).length).toBeGreaterThan(1);
});

test('Forgot password email, english', async () => {
    const user = new UserModel({ ...defaultUserData, preferences: { lang: 'en' } });
    await resetPasswordEmail(user, { resetPasswordUrl: confirmUrl });

    const sentEmails = nodemailerMock.mock.getSentMail();
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].from).toEqual(fromEmail);
    expect(sentEmails[0].to).toEqual(defaultUserData.email);
    expect(sentEmails[0].subject).toContain('Forgotten password');
    expect(sentEmails[0].text).toContain('Hi ');
    expect(sentEmails[0].text).toContain(confirmUrl);
    expect(sentEmails[0].text).toContain('\n');
    expect(sentEmails[0].html).toContain('Hi ');
    expect(sentEmails[0].html).toContain(`<a href="${confirmUrl}">${confirmUrl}</a>`);
    expect((sentEmails[0].html as any).match(/\<br\/\>/g).length).toBeGreaterThan(1);
});

test('Confirmed by admin email', async () => {
    const user = new UserModel({ ...defaultUserData });
    await sendConfirmedByAdminEmail(user);

    const sentEmails = nodemailerMock.mock.getSentMail();
    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].from).toEqual(fromEmail);
    expect(sentEmails[0].to).toEqual(defaultUserData.email);
    expect(sentEmails[0].subject).toContain('compte confirmé');
});

test('Validate email exists', async () => {
    expect(() => validateEmailExists(null, 'null email')).toThrow('null email');
    expect(() => validateEmailExists(undefined, 'undefined email')).toThrow('undefined email');
    expect(() => validateEmailExists('', 'empty email')).toThrow('empty email');
    expect(validateEmailExists(fromEmail, '')).toBe(fromEmail);
});

describe('sendEmail function', () => {
    test('Send email, arbitrary email', async () => {
        await sendEmail({
            mailText: 'Test Text',
            mailSubject: 'Test subject',
            toUser: {
                email: defaultUserData.email,
                lang: 'en',
                displayName: defaultUserData.email
            }
        }, {});

        const sentEmails = nodemailerMock.mock.getSentMail();
        expect(sentEmails.length).toBe(1);
        expect(sentEmails[0].from).toEqual(fromEmail);
        expect(sentEmails[0].to).toEqual(defaultUserData.email);
        expect(sentEmails[0].subject).toEqual('Test subject');
        expect(sentEmails[0].text).toEqual('Test Text');
        expect(sentEmails[0].html).toEqual('Test Text');
    });

    test('Send email, arbitrary email with translation array', async () => {
        await sendEmail({
            mailText: ['translationNs1:textString', 'translationNs2:textString'],
            mailSubject: ['translationNs1:subjectString', 'translationNs2:subjectString'],
            toUser: {
                email: defaultUserData.email,
                lang: 'en',
                displayName: defaultUserData.email
            }
        }, {});

        const sentEmails = nodemailerMock.mock.getSentMail();
        expect(sentEmails.length).toBe(1);
        expect(sentEmails[0].from).toEqual(fromEmail);
        expect(sentEmails[0].to).toEqual(defaultUserData.email);
        expect(sentEmails[0].subject).toEqual('subjectString');
        expect(sentEmails[0].text).toEqual('textString');
        expect(sentEmails[0].html).toEqual('textString');
    });
});
