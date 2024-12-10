/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Reducer } from 'redux';
import { AuthState, AuthActionTypes } from './types';
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';

// Type-safe initialState!
export const initialState: AuthState = {
    isAuthenticated: false
};

type AuthAction =
    | {
          type: AuthActionTypes.LOGIN;
          user: CliUser | null;
          isAuthenticated: boolean;
          register?: boolean;
          login?: boolean;
      }
    | { type: AuthActionTypes.LOGOUT; user: null; isAuthenticated: false; register?: boolean }
    | { type: AuthActionTypes.FORGOT; forgot: boolean; emailExists: boolean; message: string }
    | { type: AuthActionTypes.RESET; status: string };

// Thanks to Redux 4's much simpler typings, we can take away a lot of typings on the reducer side,
// everything will remain type-safe.
const reducer: Reducer<AuthState, AuthAction> = (state = initialState, action) => {
    switch (action.type) {
    case AuthActionTypes.LOGIN:
        return {
            user: action.user,
            isAuthenticated: action.isAuthenticated,
            register: action.register,
            login: action.login
        };
    case AuthActionTypes.FORGOT:
        return {
            ...state,
            forgot: action.forgot,
            emailExists: action.emailExists,
            error: action.message
        };
    case AuthActionTypes.LOGOUT:
        return {
            user: action.user,
            isAuthenticated: action.isAuthenticated,
            register: action.register
        };
    case AuthActionTypes.RESET:
        return {
            ...state,
            status: action.status
        };
    default:
        return state;
    }
};

// Instead of using default export, we use named exports. That way we can group these exports
// inside the `index.js` folder.
export { reducer as authReducer };
