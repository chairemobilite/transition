/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { PropsWithChildren } from 'react';
import { RouteProps } from 'react-router';
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';

import { Header } from '../pageParts';

/*const mapStateToProps = (state) => ({
    isAuthenticated: !!state.auth.uuid
});*/
type PublicRouteProps = RouteProps & {
    isAuthenticated: boolean;
    component: any;
    componentProps?: { [prop: string]: unknown };
    user?: CliUser;
    config?: { [key: string]: unknown };
} & PropsWithChildren;

const PublicRoute = ({ component: Component, children, ...rest }: PublicRouteProps) => {
    return (
        <React.Fragment>
            <Header path={rest.path as string} appName={rest.config?.appName as string} />
            <Component {...rest.componentProps} config={rest.config} />
        </React.Fragment>
    );
};

export default PublicRoute;
