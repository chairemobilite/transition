/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { connect } from 'react-redux';
import { History, Location } from 'history';

import { startAnonymousLogin } from '../../../../actions/Auth';

export interface AnonymousLoginProps {
    isAuthenticated?: boolean;
    history: History;
    location: Location;
    startAnonymousLogin: (callback?: () => void) => void;
    login?: boolean;
}

export const AnonymousLogin: React.FunctionComponent<AnonymousLoginProps> = (props: AnonymousLoginProps) => {
    React.useEffect(() => {
        props.startAnonymousLogin();
    }, []);
    return null;
};

const mapStateToProps = (state) => {
    return { isAuthenticated: state.auth.isAuthenticated, login: state.auth.login };
};

const mapDispatchToProps = (dispatch, props: Omit<AnonymousLoginProps, 'startAnonymousLogin'>) => ({
    startAnonymousLogin: (callback?: () => void) =>
        dispatch(startAnonymousLogin(props.history, props.location, callback))
});

export default connect(mapStateToProps, mapDispatchToProps)(AnonymousLogin);
