/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import projectConfig, {
    ProjectConfiguration,
    setProjectConfiguration
} from 'chaire-lib-common/lib/config/shared/project.config';

const defaultSectionsConfig = {
    agencies: {
        localizedTitle: 'transit:transitAgency:AgenciesAndLines',
        icon: '/dist/images/icons/transit/lines_white.svg'
    },
    nodes: {
        localizedTitle: 'transit:transitNode:Nodes',
        icon: '/dist/images/icons/transit/node_white.svg'
    },
    services: {
        localizedTitle: 'transit:transitService:Services',
        icon: '/dist/images/icons/transit/service_white.svg'
    },
    scenarios: {
        localizedTitle: 'transit:transitScenario:Scenarios',
        icon: '/dist/images/icons/transit/scenario_white.svg'
    },
    routing: {
        localizedTitle: 'main:Routing',
        icon: '/dist/images/icons/interface/routing_white.svg'
    },
    comparison: {
        localizedTitle: 'transit:transitComparison:ScenarioComparison',
        icon: '/dist/images/icons/transit/comparison_white.svg'
    },
    accessibilityMap: {
        localizedTitle: 'main:AccessibilityMap',
        icon: '/dist/images/icons/interface/accessibility_map_white.svg'
    },
    batchCalculation: {
        localizedTitle: 'main:BatchCalculation',
        icon: '/dist/images/icons/interface/od_routing_white.svg'
    },
    simulations: {
        localizedTitle: 'transit:simulation:Simulations',
        icon: '/dist/images/icons/interface/simulation_white.svg',
        enabled: false // Disabled by default as accessing this features requires CLI access
    },
    gtfsImport: {
        localizedTitle: 'transit:gtfs:Import',
        icon: '/dist/images/icons/interface/import_white.svg'
    },
    gtfsExport: {
        localizedTitle: 'transit:gtfs:Export',
        icon: '/dist/images/icons/interface/export_white.svg'
    },
    preferences: {
        localizedTitle: 'main:Preferences',
        icon: '/dist/images/icons/interface/preferences_white.svg'
    }
};

// Make sure default values are set
setProjectConfiguration<ProjectConfiguration<unknown>>({
    sections: Object.assign({}, defaultSectionsConfig, projectConfig.sections)
});

export default projectConfig as ProjectConfiguration<unknown>;
