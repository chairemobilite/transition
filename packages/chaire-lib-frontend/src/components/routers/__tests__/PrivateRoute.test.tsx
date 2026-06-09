/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';

import configureStore from '../../../store/configureStore';

// Header pulls in ESM-only deps (react-markdown) that jest does not transform;
// it is irrelevant to the redirect logic under test, so stub it out.
jest.mock('../../pageParts', () => ({ Header: () => null }));

import PrivateRoute from '../PrivateRoute';

// Login stand-in that exposes the referrer PrivateRoute stored in location.state,
// so tests can assert the originally requested URL is preserved (issue #1946).
const LoginStub = () => {
    const location = useLocation();
    const referrer = (location.state as { referrer?: string } | null)?.referrer;
    return <div>login:{referrer ?? 'none'}</div>;
};

const renderAt = (initialEntry: string) => {
    const store = configureStore({ auth: { isAuthenticated: false } });
    return render(
        <Provider store={store}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path="/protected" element={<PrivateRoute component={() => <div>protected</div>} />} />
                    <Route path="/login" element={<LoginStub />} />
                </Routes>
            </MemoryRouter>
        </Provider>
    );
};

afterEach(cleanup);

describe('PrivateRoute redirect to login', () => {
    test.each([
        ['/protected', '/protected'],
        ['/protected?token=abc', '/protected?token=abc'],
        ['/protected#section', '/protected#section']
    ])('unauthenticated access to %s redirects to login with referrer', (entry, expectedReferrer) => {
        renderAt(entry);
        expect(screen.getByText(`login:${expectedReferrer}`)).toBeInTheDocument();
    });
});
