/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { setProjectConfiguration } from 'chaire-lib-common/lib/config/shared/project.config';
import projectConfig from '../project.config';

describe('Project Configuration', () => {
    test('should include default sections', () => {
        const defaultSections = {
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
                enabled: false
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

        expect(projectConfig.sections).toEqual(expect.objectContaining(defaultSections));
    });

    test('should retain previous configuration', () => {
        const previousConfig = {
            sections: {
                customSection: {
                    localizedTitle: 'custom:CustomSection',
                    icon: '/dist/images/icons/custom/custom_icon.svg'
                }
            }
        };

        setProjectConfiguration(previousConfig);

        const expectedConfig = {
            ...previousConfig,
            sections: {
                ...previousConfig.sections,
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
                    enabled: false
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
            }
        };

        expect(projectConfig.sections).toEqual(expect.objectContaining(expectedConfig.sections));
    });
});
