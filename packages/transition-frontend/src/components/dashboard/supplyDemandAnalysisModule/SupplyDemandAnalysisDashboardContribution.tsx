/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';

import {
    DashboardContribution,
    Contribution,
    LayoutSectionProps
} from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import BatchCalculationPanel from '../../forms/batchCalculation/BatchCalculationPanel';

/**
 * Dashboard contribution for the 'supply/demand interaction analysis and
 * modelisation' module of Transition: batch analysis of routing and accessibility, etc.
 */
export class SupplyDemandAnalysisDashboardContribution extends DashboardContribution {
    getLayoutContributions = (): Contribution<LayoutSectionProps>[] => [
        {
            id: 'scenarioAnalysisRightPanel',
            placement: 'primarySidebar' as const,
            section: 'batchCalculation',
            create: (props: any) => <BatchCalculationPanel {...props}></BatchCalculationPanel>
        }
    ];
}
