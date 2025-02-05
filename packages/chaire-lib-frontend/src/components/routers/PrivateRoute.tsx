/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Navigate, RouteProps } from 'react-router';

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
    const auth = useSelector((state: { auth: AuthState }) => ({
        isAuthenticated: !!state.auth.isAuthenticated,
        user: state.auth.user
    }));

    return auth.isAuthenticated && auth.user ? (
        permissions ? (
            auth.user.isAuthorized(permissions) ? (
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
        <Navigate to="/login" />
    );
};

export default PrivateRoute;
