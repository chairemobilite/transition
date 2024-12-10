/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
*/
import * as React from 'react';

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router';
import { setApplicationConfiguration } from '../../../config/application.config';
import LoginPage from '../LoginPage';

const mockHomePage = '/Homepage';
setApplicationConfiguration({ homePage: mockHomePage });

import configureStore from '../../../store/configureStore';  // Create similar to docs example

const renderWithProviders = (
    ui,
    {
        preloadedState = {
            auth: {
                isAuthenticated: false
            }
        },
        initialEntries = ['/login'],
        ...renderOptions
    } = {}
) => {
    const store = configureStore(preloadedState);
    const Wrapper = ({ children }) => (
        <Provider store={store}>
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route path="/login" element={children} />
                    <Route path={mockHomePage} element={<div>Home Page</div>} />
                    <Route path="/register" element={<div>Register Page</div>} />
                    <Route path="/forgot" element={<div>Forgot Password Page</div>} />
                </Routes>
            </MemoryRouter>
        </Provider>
    );

    return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};

describe('Login page rendering', () => {
    test('Is already authenticated, redirect to home page', () => {

        renderWithProviders(
            <LoginPage config={{
                allowRegistration: true,
                forgotPasswordPage: true
            }}/>,
            { preloadedState: { auth: { isAuthenticated: true } } }
        );

        expect(screen.getByText('Home Page')).toBeInTheDocument();
    });

    test('Allow registration, no forgot password page', () => {
        const { container } = renderWithProviders(
            <LoginPage config={{
                allowRegistration: true,
                forgotPasswordPage: false
            }}/>
        );
        expect(container).toMatchSnapshot();
    });

    test('Registration not allowed, no forgot password page', () => {
        const { container } = renderWithProviders(
            <LoginPage config={{
                allowRegistration: false
            }}/>
        );
        expect(container).toMatchSnapshot();
    });

    test('Registration allowed, allow forget password', () => {
        const { container } = renderWithProviders(
            <LoginPage config={{
                allowRegistration: true,
                forgotPasswordPage: true
            }}/>
        );
        expect(container).toMatchSnapshot();
    });
});
