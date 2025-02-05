/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { RouteProps } from 'react-router';

import config from 'chaire-lib-common/lib/config/shared/project.config';
import { Header } from '../pageParts';

type PublicRouteProps = RouteProps & {
    component: any;
    componentProps?: { [prop: string]: unknown };
};

const PublicRoute = ({ component: Component, children: _children, ...rest }: PublicRouteProps) => (
    <React.Fragment>
        <Header path={rest.path as string} appName={config?.appName as string} />
        <Component {...rest.componentProps} config={config} />
    </React.Fragment>
);

export default PublicRoute;
