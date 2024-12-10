/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Route, Routes } from 'react-router';
import { useSelector } from 'react-redux';

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

type TransitionRouterProps = {
    contributions: DashboardContribution[];
    mainMap: React.ComponentType<MainMapProps>;
    config: any;
};

const TransitionRouter: React.FunctionComponent<TransitionRouterProps> = (props: TransitionRouterProps) => {
    //const navigate = useNavigate();
    //const location = useLocation();
    const auth = useSelector((state: any) => ({
        isAuthenticated: state.auth.isAuthenticated,
        user: state.auth.user
    }));

    return (
        <Routes>
            <Route
                path="/register"
                element={
                    <PublicRoute
                        isAuthenticated={auth.isAuthenticated}
                        component={RegisterPage}
                        config={{ ...props.config, queryString: location.search }}
                    />
                }
            />
            <Route
                path="/forgot"
                element={
                    <PublicRoute
                        isAuthenticated={auth.isAuthenticated}
                        component={ForgotPage}
                        config={{ ...props.config, queryString: location.search }}
                    />
                }
            />
            <Route
                path="/unconfirmed"
                element={
                    <PublicRoute
                        isAuthenticated={auth.isAuthenticated}
                        component={UnconfirmedPage}
                        config={{ ...props.config, queryString: location.search }}
                    />
                }
            />
            <Route
                path="/verify/:token"
                element={
                    <PublicRoute
                        isAuthenticated={auth.isAuthenticated}
                        component={VerifyPage}
                        config={{ ...props.config, queryString: location.search }}
                    />
                }
            />
            <Route
                path="/reset/:token"
                element={
                    <PublicRoute
                        isAuthenticated={auth.isAuthenticated}
                        component={ResetPasswordPage}
                        config={{ ...props.config, queryString: location.search }}
                    />
                }
            />
            <Route
                path="/unauthorized"
                element={
                    <PublicRoute
                        isAuthenticated={auth.isAuthenticated}
                        component={UnauthorizedPage}
                        config={{ ...props.config, queryString: location.search }}
                    />
                }
            />
            <Route
                path="/login"
                element={
                    <PublicRoute isAuthenticated={auth.isAuthenticated} component={LoginPage} config={props.config} />
                }
            />
            <Route
                path="/"
                element={
                    <PrivateRoute
                        isAuthenticated={auth.isAuthenticated}
                        user={auth.user}
                        component={DashboardTransition}
                        componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                        config={props.config}
                    />
                }
            />
            <Route
                path="/"
                element={
                    <PrivateRoute
                        isAuthenticated={auth.isAuthenticated}
                        user={auth.user}
                        component={DashboardTransition}
                        componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                        config={props.config}
                    />
                }
            />
            <Route
                path="/dashboard"
                element={
                    <PrivateRoute
                        isAuthenticated={auth.isAuthenticated}
                        user={auth.user}
                        component={DashboardTransition}
                        componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                        config={props.config}
                    />
                }
            />
            <Route
                path="/home"
                element={
                    <PrivateRoute
                        isAuthenticated={auth.isAuthenticated}
                        user={auth.user}
                        component={DashboardTransition}
                        componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                        config={props.config}
                    />
                }
            />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
};

export default TransitionRouter;
