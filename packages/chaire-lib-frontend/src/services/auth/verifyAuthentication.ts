/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Dispatch } from 'redux';
import { login, logout } from '../../actions/Auth';

export default async (dispatch: Dispatch) => {
    try {
        const response = await fetch('/verifyAuthentication', { credentials: 'include' });
        if (response.status === 200) {
            // authorized (user authentication succeeded)
            const body = await response.json();
            if (body.user) {
                dispatch(login(body.user, true));
            } else {
                dispatch(logout());
            }
        } else if (response.status === 401) {
            dispatch(logout());
        }
    } catch (err) {
        console.log('Error verifying authentication.', err);
    }
};
