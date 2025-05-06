/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router';

import i18n from 'chaire-lib-frontend/lib/config/i18n.config';
import TransitionRouter from './components/routers/TransitionRouter';
import MainMap from './components/map/TransitionMainMapNew';
import configureStore from 'chaire-lib-frontend/lib/store/configureStore';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';
import config from 'chaire-lib-frontend/lib/config/project.config';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import {
    SupplyManagementDashboardContribution,
    DemandManagementDashboardContribution
} from './components/dashboard/TransitionDashboardContribution';
import { SupplyDemandAnalysisDashboardContribution } from './components/dashboard/supplyDemandAnalysisModule/SupplyDemandAnalysisDashboardContribution';
import { setApplicationConfiguration } from 'chaire-lib-frontend/lib/config/application.config';
import verifyAuthentication from 'chaire-lib-frontend/lib/services/auth/verifyAuthentication';

import 'chaire-lib-frontend/lib/styles/styles-transition.scss';
import './styles/transition.scss';
import { TFunction } from 'i18next';

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
            <BrowserRouter>
                <TransitionRouter contributions={contributions} mainMap={MainMap as any} />
            </BrowserRouter>
        </I18nextProvider>
    </Provider>
);

const root = createRoot(document.getElementById('app') as HTMLElement);
root.render(<LoadingPage />);

let hasRendered = false;
const renderApp = () => {
    if (!hasRendered) {
        root.render(jsx);
        hasRendered = true;
    }
};

verifyAuthentication(store.dispatch).finally(() => renderApp());
