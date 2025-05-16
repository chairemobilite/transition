/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { Route, Routes } from 'react-router';

import DashboardTransition from '../dashboard/TransitionDashboard';
import { MainMapProps } from '../map/types/TransitionMainMapTypes';
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
};

const TransitionRouter: React.FunctionComponent<TransitionRouterProps> = (props: TransitionRouterProps) => {
    return (
        <Routes>
            <Route path="/register" element={<PublicRoute component={RegisterPage} />} />
            <Route path="/forgot" element={<PublicRoute component={ForgotPage} />} />
            <Route path="/unconfirmed" element={<PublicRoute component={UnconfirmedPage} />} />
            <Route path="/verify/:token" element={<PublicRoute component={VerifyPage} />} />
            <Route path="/reset/:token" element={<PublicRoute component={ResetPasswordPage} />} />
            <Route path="/unauthorized" element={<PublicRoute component={UnauthorizedPage} />} />
            <Route path="/login" element={<PublicRoute component={LoginPage} />} />
            <Route
                path="/"
                element={
                    <PrivateRoute
                        component={DashboardTransition}
                        componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                    />
                }
            />
            <Route
                path="/"
                element={
                    <PrivateRoute
                        component={DashboardTransition}
                        componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                    />
                }
            />
            <Route
                path="/dashboard"
                element={
                    <PrivateRoute
                        component={DashboardTransition}
                        componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                    />
                }
            />
            <Route
                path="/home"
                element={
                    <PrivateRoute
                        component={DashboardTransition}
                        componentProps={{ contributions: props.contributions, mainMap: props.mainMap }}
                    />
                }
            />
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
};

export default TransitionRouter;
