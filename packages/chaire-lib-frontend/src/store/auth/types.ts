/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { FrontendUser } from '../../services/auth/user';

export enum AuthActionTypes {
    LOGIN = 'LOGIN',
    FORGOT = 'FORGOT',
    LOGOUT = 'LOGOUT',
    RESET = 'RESET'
}

export type AuthAction =
    | {
          type: AuthActionTypes.LOGIN;
          user: FrontendUser | null | undefined;
          isAuthenticated: boolean;
          register: boolean;
          login: boolean;
      }
    | {
          type: AuthActionTypes.FORGOT;
          forgot: boolean;
          emailExists: boolean;
          message: string;
      }
    | {
          type: AuthActionTypes.RESET;
          status: string;
      }
    | {
          type: AuthActionTypes.LOGOUT;
          user: null;
          isAuthenticated: boolean;
          register: boolean;
      };

export interface AuthState {
    readonly user?: FrontendUser | null;
    readonly isAuthenticated: boolean;
    readonly register?: boolean;
    readonly login?: boolean;
    readonly forgot?: boolean;
    readonly emailExists?: boolean;
    readonly error?: string;
    readonly status?: string;
}
