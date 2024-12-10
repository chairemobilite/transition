/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { PropsWithChildren } from 'react';
import { Navigate, RouteProps } from 'react-router';

import { Header } from '../pageParts';
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';

export type PrivateRouteProps = RouteProps & {
    isAuthenticated: boolean;
    component: any;
    componentProps: { [prop: string]: unknown };
    user: CliUser;
    permissions?: { [subject: string]: string | string[] };
    config?: { [key: string]: unknown };
} & PropsWithChildren;

const PrivateRoute = ({ permissions, component: Component, children, ...rest }: PrivateRouteProps) => {
    return rest.isAuthenticated ? (
        permissions ? (
            rest.user.isAuthorized(permissions) ? (
                <React.Fragment>
                    <Header path={rest.path as string} appName={rest.config?.appName as string} />
                    <Component {...rest.componentProps} />
                </React.Fragment>
            ) : (
                <Navigate to="/unauthorized" />
            )
        ) : (
            <React.Fragment>
                <Header path={rest.path as string} appName={rest.config?.appName as string} />
                <Component {...rest.componentProps} />
            </React.Fragment>
        )
    ) : (
        <Navigate to="/login" />
    );
};

export default PrivateRoute;
