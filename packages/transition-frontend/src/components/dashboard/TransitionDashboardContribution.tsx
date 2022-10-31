/*
 * Copyright 2022, Polytechnique Montreal and contributors
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
import BottomPanel from './TransitionBottomPanel';
import MenuBar from './TransitionMenuBar';
import Toolbar from './TransitionToolbar';
import FullSizePanel from './TransitionFullSizePanel';
import RightPanel from './TransitionRightPanel';
import SimulationsPanel from '../forms/simulation/SimulationPanel';
import Simulation from 'transition-common/lib/services/simulation/Simulation';
import { EvolutionAlgorithmDescriptor } from 'transition-common/lib/services/evolutionaryAlgorithm';

/**
 * Dashboard contribution for the 'supply management' module of Transition: this
 * includes the agencies edition, GTFS import/export, routing and accessibility
 * map
 */
export class SupplyManagementDashboardContribution extends DashboardContribution {
    getLayoutContributions = (): Contribution<LayoutSectionProps>[] => [
        {
            id: 'agenciesBottomPanel',
            section: 'agencies',
            placement: 'bottomPanel',
            create: (props: LayoutSectionProps) => <BottomPanel {...props}></BottomPanel>
        },
        {
            id: 'transitionMenu',
            placement: 'menu' as const,
            create: (props: LayoutSectionProps) => <MenuBar {...props}></MenuBar>
        },
        {
            id: 'transitionToolbar',
            placement: 'toolbar' as const,
            create: (props: LayoutSectionProps) => <Toolbar {...props}></Toolbar>
        },
        {
            id: 'transitionFSPanel',
            placement: 'mapOverlay' as const,
            section: 'agencies',
            create: (props: LayoutSectionProps) => <FullSizePanel {...props}></FullSizePanel>
        },
        {
            id: 'transitionRightPanel',
            placement: 'primarySidebar' as const,
            create: (props: any) => <RightPanel {...props}></RightPanel>
        }
    ];
}

// FIXME: This is not the right place to do so... maybe get from server? to have one single place to manage algorithm, but then the descriptor will have to be serialized.
Simulation.registerAlgorithm('evolutionaryAlgorithm', new EvolutionAlgorithmDescriptor());

/**
 * Dashboard contribution for the 'demand management' module of Transition:
 * simulations
 */
export class DemandManagementDashboardContribution extends DashboardContribution {
    getLayoutContributions = (): Contribution<LayoutSectionProps>[] => [
        {
            id: 'simulationRightPanel',
            placement: 'primarySidebar',
            section: 'simulations',
            create: (props) => <SimulationsPanel {...props}></SimulationsPanel>
        }
    ];
}
