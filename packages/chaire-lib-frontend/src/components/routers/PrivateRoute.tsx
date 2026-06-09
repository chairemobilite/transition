/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Navigate, RouteProps, useLocation } from 'react-router';

import config from 'chaire-lib-common/lib/config/shared/project.config';
import { Header } from '../pageParts';
import { useSelector } from 'react-redux';
import { AuthState } from '../../store/auth';

export type PrivateRouteProps = RouteProps & {
    component: any;
    componentProps?: { [prop: string]: unknown };
    permissions?: { [subject: string]: string | string[] };
};

const PrivateRoute = ({ permissions, component: Component, ...rest }: PrivateRouteProps) => {
    const user = useSelector((state: { auth: AuthState }) => state.auth.user);
    const isAuthenticated = useSelector((state: { auth: AuthState }) => !!state.auth.isAuthenticated);
    const location = useLocation();

    // Remember the requested URL so redirectAfterLogin (which reads
    // location.state.referrer) can send the user back here after they log in,
    // instead of always falling back to the home page (see issue #1946).
    const referrer = `${location.pathname}${location.search}${location.hash}`;

    return isAuthenticated && user ? (
        permissions ? (
            user.isAuthorized(permissions) ? (
                <React.Fragment>
                    <Header path={rest.path as string} appName={config?.appName as string} />
                    <Component {...rest.componentProps} />
                </React.Fragment>
            ) : (
                <Navigate to="/unauthorized" />
            )
        ) : (
            <React.Fragment>
                <Header path={rest.path as string} appName={config?.appName as string} />
                <Component {...rest.componentProps} />
            </React.Fragment>
        )
    ) : (
        <Navigate to="/login" state={{ referrer }} replace />
    );
};

export default PrivateRoute;
