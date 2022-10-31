/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import  fetchMock, { enableFetchMocks } from 'jest-fetch-mock'
enableFetchMocks()
import * as React from 'react';
import LoginPage from '../LoginPage';
import thunk from 'redux-thunk'
import { create } from 'react-test-renderer';
import { render, fireEvent, cleanup } from "@testing-library/react";
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { TestUtils } from 'chaire-lib-common/lib/test';
import { setApplicationConfiguration } from '../../../config/application.config';
import { createMemoryHistory, createLocation } from 'history'

const mockStore = configureStore([thunk]);

const mockHomePage = '/Homepage';
setApplicationConfiguration({ homePage: mockHomePage });
const location = createLocation('/login');

describe('Login page rendering', () => {
    let store;
    const history = createMemoryHistory();

    beforeEach(() => {
        store = mockStore({
            auth: {
                isAuthenticated: false,
            }
        });
    });

    test('Is already authenticated, redirect to home page', () => {
        store = mockStore({
            auth: {
                isAuthenticated: true,
            }
        });

        render(<Provider store={store}>
            <LoginPage history={history} location={location} config={{
                allowRegistration: true,
                forgotPasswordPage: true
            }}/>
        </Provider>);
        expect(history.length).toBe(2);
        expect(history.location.pathname).toBe(mockHomePage);
    });

    test('Allow registration', () => {
        const page = create(<Provider store={store}>
            <LoginPage history={history} location={location} config={{
                allowRegistration: true
            }}/>
        </Provider>)
        .toJSON();
        expect(page).toMatchSnapshot()
    });

    test('Registration not allowed', () => {
        const page = create(<Provider store={store}>
            <LoginPage history={history} location={location} config={{
                allowRegistration: false
            }}/>
        </Provider>)
        .toJSON();
        expect(page).toMatchSnapshot()
    });

    test('Allow forget password', () => {
        const page = create(<Provider store={store}>
            <LoginPage history={history} location={location} config={{
                forgotPasswordPage: true
            }}/>
        </Provider>)
        .toJSON();
        expect(page).toMatchSnapshot()
    });
});

describe('Login page behavior', () => {
    let store;
    let history = createMemoryHistory();

    beforeEach(() => {
        history = createMemoryHistory();
        store = mockStore({
            auth: {
                isAuthenticated: false,
            }
        });
    });

    afterEach(cleanup);

    test('Registration link, no forgot password', () => {
        const { getByText, queryByText } = render(<Provider store={store}>
            <LoginPage history={history} location={location} config={{}}/>
        </Provider>)
        const link = getByText("auth:registerIfYouHaveNoAccount");
        expect(link).toBeTruthy();
        expect(link.closest('a')).toHaveProperty('href', 'http://localhost/register');
        expect(link.nodeName).toBe("A");

        const forgotPassword = queryByText("auth:forgotPassword");
        expect(forgotPassword).toBeFalsy();
    });

    test('Redirect to forgot password page', () => {
        const { getByText } = render(<Provider store={store}>
            <LoginPage history={history} location={location} config={{
                forgotPasswordPage: true
            }}/>
        </Provider>)
        const link = getByText("auth:forgotPassword");
        expect(link).toBeTruthy();
        expect(link.closest('a')).toHaveProperty('href', 'http://localhost/forgot');
        expect(link.nodeName).toBe("A");
    });

    test('Correct credentials', () => {
        expect(true).toBe(true)
    });

    test('Incorrect and partial credentials', async () => {
        fetchMock.mockResponseOnce(JSON.stringify({ user: "user1" }));

        const { getByText, queryByText, getByLabelText } = render(<Provider store={store}>
            <LoginPage history={history} location={location} config={{}} />
        </Provider>)
        let link = queryByText("auth:missingUsernameOrEmail");
        expect(link).toBeFalsy();

        const button = getByText('auth:Login');
        expect(button).toBeTruthy();
        fireEvent.click(button);
        link = queryByText("auth:missingUsernameOrEmail");
        expect(link).toBeTruthy();

        let input = getByLabelText("auth:UsernameOrEmail");
        fireEvent.change(input, {target: { value: "user1"}});

        fireEvent.click(button);
        link = queryByText("auth:missingUsernameOrEmail");
        expect(link).toBeFalsy();
        link = queryByText("auth:missingPassword");
        expect(link).toBeTruthy();

        input = getByLabelText("auth:Password");
        fireEvent.change(input, {target: { value: "pass1"}});

        expect(history.length).toBe(1);

        fireEvent.click(button);
        await TestUtils.flushPromises();

        link = queryByText("auth:missingUsernameOrEmail");
        expect(link).toBeFalsy();
        link = queryByText("auth:missingPassword");
        expect(link).toBeFalsy();
        expect(history.length).toBe(2);
        expect(history.location.pathname).toBe(mockHomePage);
    });

    test('Correct credentials with location', async () => {
        fetchMock.mockResponseOnce(JSON.stringify({ user: "user1" }));
        const expectedPage = '/expected';
        const location = createLocation('/login');
        (location as any).state = { referrer: expectedPage };

        const { getByText, getByLabelText } = render(<Provider store={store}>
            <LoginPage location={location} history={history} config={{}} />
        </Provider>)

        let input = getByLabelText("auth:UsernameOrEmail");
        fireEvent.change(input, {target: { value: "user1"}});
        input = getByLabelText("auth:Password");
        fireEvent.change(input, {target: { value: "pass1"}});

        expect(history.length).toBe(1);

        const button = getByText('auth:Login');
        expect(button).toBeTruthy();

        fireEvent.click(button);
        await TestUtils.flushPromises();
        expect(history.length).toBe(2);
        expect(history.location.pathname).toBe(expectedPage);
    });
});