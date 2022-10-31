/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { FrontendUser } from '../../services/auth/user';
import React from 'react';
import { connect } from 'react-redux';
import { RouteProps } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';

interface AdminRouteProps extends RouteProps {
    isAuthenticated: boolean;
    component: any;
    componentProps: { [prop: string]: unknown };
    user: FrontendUser;
}

const AdminRoute = (props: AdminRouteProps) => <PrivateRoute {...props} permissions={{ all: 'manage' }} />;

const mapStateToProps = (state) => ({
    user: state.auth.user,
    isAuthenticated: !!state.auth.isAuthenticated
});

export default connect(mapStateToProps)(AdminRoute);
