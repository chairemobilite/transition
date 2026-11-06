/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import fetchMock from 'jest-fetch-mock';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import configureStore from '../../../../../store/configureStore';
import UsersComponent from '../UsersComponent';

const users = [
    { id: 1, uuid: 'admin-uuid', username: 'admin', email: 'admin@example.org', is_admin: true, is_confirmed: true, permissions: null },
    { id: 2, uuid: 'pending-uuid', username: 'pending', email: 'pending@example.org', is_admin: false, is_confirmed: false, permissions: null },
    { id: 3, uuid: 'legacy-uuid', username: 'legacy', email: 'legacy@example.org', is_admin: null, is_confirmed: null, permissions: null }
];

const usersListResponse = (usersToReturn: typeof users) =>
    JSON.stringify({ status: 'success', totalCount: usersToReturn.length, roles: [], users: usersToReturn });

const renderComponent = () => {
    const store = configureStore({ auth: { isAuthenticated: true, user: { id: 1 } as any } });
    return render(
        <Provider store={store}>
            <UsersComponent />
        </Provider>
    );
};

const getLastFetchUrl = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;

beforeAll(async () => {
    fetchMock.enableMocks();
    await i18n.use(initReactI18next).init({
        lng: 'en',
        interpolation: { escapeValue: false },
        resources: {
            en: {
                main: { ShowingNofX: 'Showing {{n}} of {{x}} results' },
                admin: { user: { Username: 'Username', Email: 'Email', isAdmin: 'Administrator', isConfirmed: 'Confirmed' } }
            }
        }
    });
});

beforeEach(() => {
    fetchMock.resetMocks();
});

afterEach(cleanup);

describe('UsersComponent', () => {
    test('Fetches and displays the users with their confirmed and admin flags', async () => {
        fetchMock.mockResponse(usersListResponse(users));
        renderComponent();

        expect(await screen.findByText('pending@example.org')).toBeInTheDocument();
        expect(getLastFetchUrl()).toEqual('/api/admin/usersList?pageSize=10&pageIndex=0');
        expect(screen.getByText('Showing 3 of 3 results')).toBeInTheDocument();

        const pendingRow = screen.getByText('pending').closest('tr') as HTMLElement;
        const [pendingConfirmed, pendingAdmin] = within(pendingRow).getAllByRole('checkbox');
        expect(pendingConfirmed).not.toBeChecked();
        expect(pendingAdmin).not.toBeChecked();

        const legacyRow = screen.getByText('legacy').closest('tr') as HTMLElement;
        within(legacyRow).getAllByRole('checkbox').forEach((checkbox) => expect(checkbox).not.toBeChecked());

        // The current user's own flags cannot be changed
        const adminRow = screen.getByText('admin').closest('tr') as HTMLElement;
        within(adminRow).getAllByRole('checkbox').forEach((checkbox) => {
            expect(checkbox).toBeChecked();
            expect(checkbox).toBeDisabled();
        });
    });

    test('Filtering on the confirmed flag queries the server and shows an empty result', async () => {
        fetchMock.mockResponseOnce(usersListResponse(users));
        renderComponent();
        await screen.findByText('pending@example.org');

        fetchMock.mockResponseOnce(usersListResponse([]));
        const confirmedHeader = screen.getByRole('columnheader', { name: /Confirmed/ });
        fireEvent.change(within(confirmedHeader).getByRole('combobox'), { target: { value: 'false' } });

        await waitFor(() => expect(screen.getByText('Showing 0 of 0 results')).toBeInTheDocument());
        expect(getLastFetchUrl()).toEqual('/api/admin/usersList?pageSize=10&pageIndex=0&is_confirmed=false');
        expect(screen.queryByText('pending@example.org')).not.toBeInTheDocument();
    });

    test('Text filters are encoded in the query string', async () => {
        fetchMock.mockResponse(usersListResponse(users));
        renderComponent();
        await screen.findByText('pending@example.org');

        const emailHeader = screen.getByRole('columnheader', { name: /Email/ });
        fireEvent.change(within(emailHeader).getByRole('textbox'), { target: { value: 'name+tag@example.org' } });

        await waitFor(() =>
            expect(getLastFetchUrl()).toEqual(
                '/api/admin/usersList?pageSize=10&pageIndex=0&email=name%2Btag%40example.org'
            )
        );
    });
});
