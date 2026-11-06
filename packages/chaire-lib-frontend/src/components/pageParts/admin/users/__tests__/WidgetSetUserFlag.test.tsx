/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import fetchMock from 'jest-fetch-mock';

import configureStore from '../../../../../store/configureStore';
import WidgetSetUserFlag, { type UserFlag } from '../WidgetSetUserFlag';

const currentUserId = 1;
const otherUserId = 2;
const otherUserUuid = 'other-user-uuid';

const renderWidget = (props: { flag: UserFlag; value?: boolean | null; userId?: number }) => {
    const store = configureStore({ auth: { isAuthenticated: true, user: { id: currentUserId } as any } });
    return render(
        <Provider store={store}>
            <WidgetSetUserFlag
                flag={props.flag}
                value={props.value}
                userUuid={otherUserUuid}
                userId={props.userId ?? otherUserId}
            />
        </Provider>
    );
};

beforeAll(() => {
    fetchMock.enableMocks();
});

beforeEach(() => {
    fetchMock.resetMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {
        /* Errors are expected in some tests */
    });
});

afterEach(cleanup);

describe('WidgetSetUserFlag', () => {
    test('Null value is shown as unchecked, without apply button', () => {
        renderWidget({ flag: 'is_confirmed', value: null });

        expect(screen.getByRole('checkbox')).not.toBeChecked();
        expect(screen.queryByTitle('admin:user:ApplyChanges')).not.toBeInTheDocument();
    });

    test.each([
        ['is_confirmed', '/api/admin/updateUserSetConfirmed'],
        ['is_admin', '/api/admin/updateUserSetAdmin']
    ])('Changing and applying the %s flag calls %s', async (flag, expectedRoute) => {
        fetchMock.mockOnce(JSON.stringify({ status: 'success', uuid: otherUserUuid }));
        renderWidget({ flag: flag as UserFlag, value: false });

        fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByRole('checkbox')).toBeChecked();
        fireEvent.click(screen.getByTitle('admin:user:ApplyChanges'));

        await waitFor(() => expect(screen.queryByTitle('admin:user:ApplyChanges')).not.toBeInTheDocument());
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toEqual(expectedRoute);
        expect(options?.method).toEqual('POST');
        expect(JSON.parse(options?.body as string)).toEqual({ uuid: otherUserUuid, [flag]: true });
        expect(screen.queryByText('admin:user:ErrorSaving')).not.toBeInTheDocument();
    });

    test('Error from the server is shown and the change can be applied again', async () => {
        fetchMock.mockOnce(JSON.stringify({ status: 'Error' }), { status: 500 });
        renderWidget({ flag: 'is_confirmed', value: true });

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByTitle('admin:user:ApplyChanges'));

        expect(await screen.findByText('admin:user:ErrorSaving')).toBeInTheDocument();
        expect(screen.getByTitle('admin:user:ApplyChanges')).toBeInTheDocument();
        expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
            uuid: otherUserUuid,
            is_confirmed: false
        });
    });

    test('Network error is shown', async () => {
        fetchMock.mockRejectOnce(new Error('Network error'));
        renderWidget({ flag: 'is_admin', value: false });

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByTitle('admin:user:ApplyChanges'));

        expect(await screen.findByText('admin:user:ErrorSaving')).toBeInTheDocument();
        expect(screen.getByTitle('admin:user:ApplyChanges')).toBeInTheDocument();
    });

    test('Current user cannot change their own flag', () => {
        renderWidget({ flag: 'is_confirmed', value: true, userId: currentUserId });

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
        expect(checkbox).toBeDisabled();
        expect(screen.queryByTitle('admin:user:ApplyChanges')).not.toBeInTheDocument();
    });
});
