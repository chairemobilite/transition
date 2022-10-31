/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Route, Switch, withRouter, RouteComponentProps } from 'react-router-dom';

import DashboardTransition from '../dashboard/TransitionDashboard';
import { MainMapProps } from '../map/TransitionMainMap';
import NotFoundPage from 'chaire-lib-frontend/lib/components/pages/NotFoundPage';
import UnauthorizedPage from 'chaire-lib-frontend/lib/components/pages/UnauthorizedPage';
import { LoginPage } from 'chaire-lib-frontend/lib/components/pages';
import RegisterPage from 'chaire-lib-frontend/lib/components/pages/RegisterPage';
import ForgotPage from 'chaire-lib-frontend/lib/components/pages/ForgotPasswordPage';
import VerifyPage from 'chaire-lib-frontend/lib/components/pages/VerifyPage';
import ResetPasswordPage from 'chaire-lib-frontend/lib/components/pages/ResetPasswordPage';
import UnconfirmedPage from 'chaire-lib-frontend/lib/components/pages/UnconfirmedPage';
import PrivateRoute from 'chaire-lib-frontend/lib/components/routers/PrivateRoute';
import PublicRoute from 'chaire-lib-frontend/lib/components/routers/PublicRoute';
import { DashboardContribution } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';

interface TransitionRouterProps extends RouteComponentProps {
    contributions: DashboardContribution[];
    // TODO Map component should not be passed directly
    mainMap: React.ComponentType<MainMapProps>;
    config: any;
}

const TransitionRouter: React.FunctionComponent<TransitionRouterProps> = (props: TransitionRouterProps) => {
    return (
        <React.Fragment>
            <Switch>
                <PrivateRoute
                    path="/"
                    component={DashboardTransition}
                    componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                    config={props.config}
                    exact={true}
                />
                <PublicRoute path="/login" component={LoginPage} config={props.config} />
                <PublicRoute path="/register" component={RegisterPage} config={props.config} />
                <PublicRoute path="/forgot" component={ForgotPage} config={props.config} />
                <PublicRoute path="/unconfirmed" component={UnconfirmedPage} config={props.config} />
                <PublicRoute
                    path="/verify/:token"
                    component={VerifyPage}
                    config={props.config}
                    queryString={props.location.search}
                />
                <PublicRoute
                    path="/reset/:token"
                    component={ResetPasswordPage}
                    config={props.config}
                    queryString={props.location.search}
                />
                <PublicRoute path="/unauthorized" component={UnauthorizedPage} />
                <PrivateRoute
                    path="/dashboard"
                    component={DashboardTransition}
                    componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                    config={props.config}
                />
                <PrivateRoute
                    path="/home"
                    component={DashboardTransition}
                    componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                    config={props.config}
                />
                <Route component={NotFoundPage} config={props.config} />
            </Switch>
        </React.Fragment>
    );
};

export default withRouter(TransitionRouter);
