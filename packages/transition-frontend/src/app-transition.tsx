/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { getVersion, setWorkerUrl } from 'maplibre-gl';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router';

import i18n from 'chaire-lib-frontend/lib/config/i18n.config';
import TransitionRouter from './components/routers/TransitionRouter';
import MainMap from './components/map/TransitionMainMap';
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
import { ThemeProvider } from 'chaire-lib-frontend/lib/contexts/ThemeContext';

import 'chaire-lib-frontend/lib/styles/styles-transition.scss';
import './styles/transition.scss';
import type { TFunction } from 'i18next';

// MapLibre 6 loads the tile worker with `new Worker(url, { type: 'module' })`.
// https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/
// Webpack copies the worker file to /dist: the frontend is compiled to CommonJS, so the
// `new URL(..., import.meta.url)` pattern of the MapLibre webpack documentation is not available.
// The file name is the same in every release, so the version keeps browsers from using an old cached worker.
// This must run before the first map.
setWorkerUrl(`/dist/maplibre-gl-worker.mjs?v=${getVersion()}`);

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
            <ThemeProvider>
                <BrowserRouter>
                    <TransitionRouter contributions={contributions} mainMap={MainMap as any} />
                </BrowserRouter>
            </ThemeProvider>
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
