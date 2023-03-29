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
import { History, Location } from 'history';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

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

const redirectAfterLogin = (user: BaseUser, history: History, location?: Location, referrer?: string) => {
    const requestedPath =
        location && location.state && (location.state as any).referrer ? (location.state as any).referrer : undefined;
    history.push(requestedPath ? requestedPath : user.homePage ? user.homePage : appConfiguration.homePage);
};

export type LoginData = { usernameOrEmail: string; password: string };
export const startLogin = (data: LoginData, history: History, location: Location, callback?: () => void) => {
    return async (dispatch) => {
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
                        dispatch(callback());
                    }
                    redirectAfterLogin(user, history, location);
                } else {
                    dispatch(login(null, false, false, true));
                }
            } else if (response.status === 401) {
                dispatch(login(null, false, false, true));
                // Unconfirmed user, redirect to proper page
                history.push('/unconfirmed');
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

export const startLogout = (history: History) => {
    return async (dispatch) => {
        try {
            const response = await fetch('/logout', { credentials: 'include' });
            if (response.status === 200) {
                const body = await response.json();
                if (body.loggedOut === true) {
                    dispatch(logout());
                    history.push('/login');
                } else {
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
export const startRegisterWithPassword = (data: RegisterData, history: History, callback?: () => void) => {
    return async (dispatch) => {
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
                        dispatch(callback());
                    }
                    redirectAfterLogin(user, history);
                } else {
                    dispatch(login(null, false, true, false));
                }
            } else if (response.status === 401) {
                // Unconfirmed user, redirect to proper page
                dispatch(login(null, false, true, false));
                history.push('/unconfirmed');
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
    return async (dispatch) => {
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
                    dispatch(callback(body));
                }
            } else {
                if (typeof callback === 'function') {
                    dispatch(callback(null));
                }
            }
        } catch (err) {
            console.log('Error during forgot request.', err);
        }
    };
};

export type ForgotPwdData = { email: string };
export const startForgotPasswordRequest = (data: ForgotPwdData, _history: History) => {
    return async (dispatch) => {
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
    return async (dispatch) => {
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
    history: History,
    location: Location,
    callback?: () => void
) => {
    return async (dispatch) => {
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
                        dispatch(callback());
                    }
                    // TODO this should be configurable
                    redirectAfterLogin(user, history, location);
                } else if (success === true) {
                    history.push('/checkMagicEmail');
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

export const startPwdLessVerify = (token: string, history: History, callback?: () => void) => {
    return async (dispatch) => {
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
                        dispatch(callback());
                    }
                    if (referrer) {
                        history.push(referrer);
                    } else {
                        redirectAfterLogin(user, history);
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

export const startAnonymousLogin = (history: History, location: Location, callback?: () => void) => {
    return async (dispatch) => {
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
                        dispatch(callback());
                    }
                    redirectAfterLogin(user, history, location);
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

export const resetUserProfile = (history: History) => {
    return async (dispatch) => {
        try {
            // reset user pref on server
            const response = await fetch('/reset_user_preferences', { credentials: 'include' });
            // reset localStorage
            window.localStorage.clear();
            // reload preferences from server
            await Preferences.load(serviceLocator.socketEventManager, serviceLocator.eventManager);

            if (response.status === 200) {
                const defaultPath = appConfiguration.homePage;
                history.push(defaultPath);
            }
        } catch (err) {
            console.log('Error reset user.', err);
        }
    };
};
