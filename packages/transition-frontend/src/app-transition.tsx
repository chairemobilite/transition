/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { createBrowserHistory } from 'history';
import { Router } from 'react-router-dom';

import i18n from 'chaire-lib-frontend/lib/config/i18n.config';
import TransitionRouter from './components/routers/TransitionRouter';
import MainMap from './components/map/TransitionMainMap';
import configureStore from 'chaire-lib-frontend/lib/store/configureStore';
import { login, logout } from 'chaire-lib-frontend/lib/actions/Auth';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import config from 'chaire-lib-frontend/lib/config/project.config';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import {
    SupplyManagementDashboardContribution,
    DemandManagementDashboardContribution
} from './components/dashboard/TransitionDashboardContribution';
import { SupplyDemandAnalysisDashboardContribution } from './components/dashboard/supplyDemandAnalysisModule/SupplyDemandAnalysisDashboardContribution';
import { setApplicationConfiguration } from 'chaire-lib-frontend/lib/config/application.config';

import 'chaire-lib-frontend/lib/styles/styles-transition.scss';
import './styles/transition.scss';
import { TFunction } from 'i18next';

const history = createBrowserHistory();
setApplicationConfiguration({
    homePage: '/dashboard',
    userMenuItems: [
        {
            getText: (t: TFunction) => t('main:Preferences'),
            action: () => serviceLocator.eventManager.emit('section.change', 'preferences', false)
        }
    ]
});
// Set the application title for the header
// TODO This is a frontend only configuration, that should be configured in code, not in the config file. When configuration objects are revisited, make sure that is clear and possible
config.appTitle = 'Transition';

const store = configureStore();
const contributions = [
    new SupplyManagementDashboardContribution(),
    new DemandManagementDashboardContribution(),
    new SupplyDemandAnalysisDashboardContribution()
];
const jsx = (
    <Provider store={store}>
        <I18nextProvider i18n={i18n}>
            <Router history={history}>
                <TransitionRouter contributions={contributions} config={config} mainMap={MainMap as any} />
            </Router>
        </I18nextProvider>
    </Provider>
);

ReactDOM.render(<LoadingPage />, document.getElementById('app'));

let hasRendered = false;
const renderApp = () => {
    if (!hasRendered) {
        ReactDOM.render(jsx, document.getElementById('app'));
        hasRendered = true;
    }
};

fetch('/verifyAuthentication', { credentials: 'include' })
    .then((response) => {
        if (response.status === 200) {
            // authorized (user authentication succeeded)
            response.json().then((body) => {
                if (body.user) {
                    store.dispatch(login(body.user, true));
                } else {
                    store.dispatch(logout());
                }
                renderApp();
            });
        } else if (response.status === 401) {
            store.dispatch(logout());
            renderApp();
        } else {
            renderApp();
        }
    })
    .catch((err) => {
        console.log('Error logging in.', err);
        renderApp();
    });
