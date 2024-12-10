/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BaseUser } from 'chaire-lib-common/lib/services/user/userType';
import appConfiguration from '../config/application.config';
import { toCliUser } from '../services/auth/user';
import { AuthAction, AuthActionTypes } from '../store/auth';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { Location, NavigateFunction } from 'react-router';
import { Dispatch } from 'redux';

// Required permissions to show user information in the header menu. For some basic user roles, like anonymous users, user information may not be wanted.
let showUserInfoPerm:
    | {
          [subject: string]: string | string[];
      }
    | undefined = undefined;
export const setShowUserInfoPerm = (perms: { [subject: string]: string | string[] }) => (showUserInfoPerm = perms);

export const login = (user: BaseUser | null, isAuthenticated = false, register = false, login = false): AuthAction => ({
    type: AuthActionTypes.LOGIN,
    user: user ? toCliUser(user, appConfiguration.pages, showUserInfoPerm) : user,
    isAuthenticated,
    register,
    login
});

export const forgot = (forgot = true, emailExists = false, message = ''): AuthAction => ({
    type: AuthActionTypes.FORGOT,
    forgot,
    emailExists,
    message
});

export const reset = (status = ''): AuthAction => ({
    type: AuthActionTypes.RESET,
    status
});

export const logout = (): AuthAction => ({
    type: AuthActionTypes.LOGOUT,
    user: null,
    isAuthenticated: false,
    register: false
});

export const redirectAfterLogin = (user: BaseUser, location: Location, navigate: NavigateFunction) => {
    const requestedPath =
        location && location.state && (location.state as any).referrer ? (location.state as any).referrer : undefined;
    return navigate(requestedPath ? requestedPath : user.homePage ? user.homePage : appConfiguration.homePage);
};

export type LoginData = { usernameOrEmail: string; password: string };
// FIXME: Type the callback, it is called in a dispatch, so it needs to be a redux action
// FIXME2: See if our usage of the navigate function is correct or if we should switch to a history, compatible with the new versions of the react-router or let other components or the server do the redirect.
export const startLogin = (data: LoginData, location: Location, navigate: NavigateFunction, callback?: () => void) => {
    return async (dispatch: Dispatch) => {
        try {
            const response = await fetch('/login', {
                method: 'POST',
                body: JSON.stringify(data),
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 200) {
                const { user }: { user: BaseUser | undefined } = await response.json();
                if (user) {
                    dispatch(login(user, true, false, true));
                    if (typeof callback === 'function') {
                        dispatch((callback as any)());
                    }
                    return redirectAfterLogin(user, location, navigate);
                } else {
                    dispatch(login(null, false, false, true));
                }
            } else if (response.status === 401) {
                dispatch(login(null, false, false, true));
                // Unconfirmed user, redirect to proper page
                return navigate('/unconfirmed');
            } else {
                // Any other response status should not authenticate but still give feedback to the user
                dispatch(login(null, false, false, true));
                console.error('Error trying to log in: ', response);
            }
        } catch (err) {
            console.log('Error logging in.', err);
        }
    };
};

export const startLogout = (navigate: NavigateFunction) => {
    return async (dispatch: Dispatch) => {
        try {
            const response = await fetch('/logout', { credentials: 'include' });
            if (response.status === 200) {
                const body = await response.json();
                if (body.loggedOut === true) {
                    dispatch(logout());
                    return navigate('/login');
                }
            } else if (response.status === 401) {
                //return { user: null };
                // not authorized (user authentication failed)
            }
        } catch (err) {
            console.log('Error logging out.', err);
        }
    };
};

export type RegisterData = { username: string; email: string; generatedPassword: string | null; password: string };
export const startRegisterWithPassword = (
    data: RegisterData,
    location: Location,
    navigate: NavigateFunction,
    callback?: () => void
) => {
    return async (dispatch: Dispatch) => {
        try {
            const response = await fetch('/register', {
                method: 'POST',
                body: JSON.stringify(data),
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 200) {
                const { user }: { user: BaseUser | undefined } = await response.json();
                if (user) {
                    dispatch(login(user, true, true, false));
                    if (typeof callback === 'function') {
                        dispatch((callback as any)());
                    }
                    return redirectAfterLogin(user, location, navigate);
                } else {
                    dispatch(login(null, false, true, false));
                }
            } else if (response.status === 401) {
                // Unconfirmed user, redirect to proper page
                dispatch(login(null, false, true, false));
                return navigate('/unconfirmed');
            } else {
                dispatch(login(null, false, true, false));
            }
        } catch (error) {
            console.log('Error during registration.', error);
            dispatch(login(null, false, true, false));
        }
    };
};

export type ConfirmData = { token: string };
export type ConfirmCallbackType = (body?: { status?: string } | null) => void;
export const startConfirmUser = (data: ConfirmData, callback?: ConfirmCallbackType) => {
    return async (dispatch: Dispatch) => {
        try {
            const response = await fetch('/verify', {
                method: 'POST',
                body: JSON.stringify(data),
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 200) {
                const body = await response.json();
                if (typeof callback === 'function') {
                    dispatch((callback as any)(body));
                }
            } else {
                if (typeof callback === 'function') {
                    dispatch((callback as any)(null));
                }
            }
        } catch (err) {
            console.log('Error during forgot request.', err);
        }
    };
};

export type ForgotPwdData = { email: string };
export const startForgotPasswordRequest = (data: ForgotPwdData) => {
    return async (dispatch: Dispatch) => {
        try {
            const response = await fetch('/forgot', {
                method: 'POST',
                body: JSON.stringify(data),
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const body = await response.json();
            if (response.status === 200) {
                dispatch(forgot(true, body.emailExists, body.error));
            } else {
                console.error('Server returned an error during forgot request.', body.error);
                dispatch(forgot(true, undefined, 'cannot get response'));
            }
        } catch (err) {
            console.error('Error during forgot request.', err);
            dispatch(forgot(true, undefined, JSON.stringify(err)));
        }
    };
};

export const startResetPassword = (data) => {
    return async (dispatch: Dispatch) => {
        try {
            const response = await fetch(`/reset/${data.token}`, {
                method: 'POST',
                body: data.password ? JSON.stringify({ newPassword: data.password }) : undefined,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const body = await response.json();
            dispatch(reset(body.status));
        } catch (err) {
            console.log('Error during password change.', err);
            dispatch(reset('Error'));
        }
    };
};

export type LoginPwdlessData = { destination: string };
export const startPwdLessLogin = (
    data: LoginPwdlessData,
    location: Location,
    navigate: NavigateFunction,
    callback?: () => void
) => {
    return async (dispatch: Dispatch) => {
        try {
            const requestBody: LoginPwdlessData & { referrer?: string } = { ...data };
            if (location && location.state && (location.state as any).referrer) {
                requestBody.referrer = (location.state as any).referrer;
            }
            const response = await fetch('/pwdless', {
                method: 'POST',
                body: JSON.stringify(requestBody),
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 200) {
                const json = await response.json();
                const { user, success }: { user?: BaseUser; success?: boolean } = json;
                if (user) {
                    // Direct login after entering email or sms
                    dispatch(login(user, true, true, false));
                    if (typeof callback === 'function') {
                        dispatch((callback as any)());
                    }
                    // TODO this should be configurable
                    return redirectAfterLogin(user, location, navigate);
                } else if (success === true) {
                    return navigate('/checkMagicEmail');
                } else {
                    dispatch(login(null, false, false, true));
                }
            } else {
                // Any other response status should not authenticate but still give feedback to the user
                dispatch(login(null, false, false, true));
                console.error('Error trying to log in: ', response);
            }
        } catch (err) {
            console.log('Error logging in.', err);
        }
    };
};

export const startPwdLessVerify = (
    token: string,
    location: Location,
    navigate: NavigateFunction,
    callback?: () => void
) => {
    return async (dispatch: Dispatch) => {
        try {
            const response = await fetch(`/pwdless/verify?token=${token}`, {
                method: 'GET',
                credentials: 'include'
            });
            if (response.status === 200) {
                const { user, referrer }: { user?: BaseUser; referrer?: any } = await response.json();
                if (user) {
                    dispatch(login(user, true, false, true));
                    if (typeof callback === 'function') {
                        dispatch((callback as any)());
                    }
                    if (referrer) {
                        return navigate(referrer);
                    } else {
                        return redirectAfterLogin(user, location, navigate);
                    }
                } else {
                    dispatch(login(null, false, false, true));
                }
            } else {
                // Any other response status should not authenticate but still give feedback to the user
                dispatch(login(null, false, false, true));
                console.error('Error trying to log in: ', response);
            }
        } catch (err) {
            console.log('Error logging in.', err);
        }
    };
};

export const startAnonymousLogin = (location: Location, navigate: NavigateFunction, callback?: () => void) => {
    return async (dispatch: Dispatch) => {
        try {
            const response = await fetch('/anonymous', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.status === 200) {
                const { user }: { user: BaseUser | undefined } = await response.json();
                if (user) {
                    dispatch(login(user, true, true, false));
                    if (typeof callback === 'function') {
                        dispatch((callback as any)());
                    }
                    return redirectAfterLogin(user, location, navigate);
                } else {
                    dispatch(login(null, false, true, false));
                }
            } else {
                // Any other response status should not authenticate but still give feedback to the user
                dispatch(login(null, false, false, true));
                console.error('Error trying to log in: ', response);
            }
        } catch (err) {
            dispatch(login(null, false, false, true));
            console.log('Error logging in.', err);
        }
    };
};

export const resetUserProfile = (navigate: NavigateFunction) => {
    return async (_dispatch: Dispatch) => {
        try {
            // reset user pref on server
            const response = await fetch('/reset_user_preferences', { credentials: 'include' });
            // reset localStorage
            window.localStorage.clear();
            // reload preferences from server
            await Preferences.load(serviceLocator.socketEventManager);

            if (response.status === 200) {
                const defaultPath = appConfiguration.homePage;
                return navigate(defaultPath);
            }
        } catch (err) {
            console.log('Error reset user.', err);
        }
    };
};
