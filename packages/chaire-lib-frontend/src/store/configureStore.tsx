/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createStore, combineReducers, applyMiddleware, compose, type Store } from 'redux';
import { thunk, type ThunkMiddleware } from 'redux-thunk';

import { authReducer } from './auth';
import type { AuthState } from './auth/types';

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
    }
}

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const initialState = {};

export type RootState = {
    auth: AuthState;
};

export default (preloadedState = initialState): Store => {
    const store = createStore(
        combineReducers({
            auth: authReducer
        }),
        preloadedState,
        composeEnhancers(applyMiddleware(thunk as ThunkMiddleware<RootState>))
    );
    return store;
};
