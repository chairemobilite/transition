/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { connect } from 'react-redux';
import { Route, Redirect, RouteProps } from 'react-router-dom';

import { Header } from '../pageParts';
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';

interface PrivateRouteProps extends RouteProps {
    isAuthenticated: boolean;
    component: any;
    componentProps: { [prop: string]: unknown };
    user: CliUser;
    permissions?: { [subject: string]: string | string[] };
    config?: { [key: string]: unknown };
}

export const PrivateRoute = ({ isAuthenticated, permissions, component: Component, ...rest }: PrivateRouteProps) => (
    <Route
        {...rest}
        component={(props) => {
            const isAuthorized = isAuthenticated && (permissions ? rest.user.isAuthorized(permissions) : true);
            return isAuthenticated ? (
                isAuthorized ? (
                    <React.Fragment>
                        <Header {...props} path={rest.path} />
                        <Component {...props} location={rest.location} {...rest.componentProps} />
                    </React.Fragment>
                ) : (
                    <Redirect
                        to={{
                            pathname: '/unauthorized',
                            state: { referrer: props.location }
                        }}
                    />
                )
            ) : (
                <Redirect
                    to={{
                        pathname: '/login',
                        state: { referrer: props.location }
                    }}
                />
            );
        }}
    />
);

const mapStateToProps = (state) => ({
    user: state.auth.user,
    isAuthenticated: !!state.auth.isAuthenticated
});

export default connect(mapStateToProps)(PrivateRoute);
