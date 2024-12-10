/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import PrivateRoute, { PrivateRouteProps } from './PrivateRoute';

// FIXME Admin route and permissions are not really used in transition.
// chaire-lib cannot really test it. Since it is there for evolution, evolution
// should implement it.
const AdminRoute = (props: PrivateRouteProps) => <PrivateRoute {...props} permissions={{ all: 'manage' }} />;

export default AdminRoute;
