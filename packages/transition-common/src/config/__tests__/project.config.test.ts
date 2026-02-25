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
                iconWhite: '/dist/images/icons/transit/lines_white.svg',
                iconBlack: '/dist/images/icons/transit/lines_black.svg'
            },
            nodes: {
                localizedTitle: 'transit:transitNode:Nodes',
                iconWhite: '/dist/images/icons/transit/node_white.svg',
                iconBlack: '/dist/images/icons/transit/node_black.svg'
            },
            services: {
                localizedTitle: 'transit:transitService:Services',
                iconWhite: '/dist/images/icons/transit/service_white.svg',
                iconBlack: '/dist/images/icons/transit/service_black.svg'
            },
            scenarios: {
                localizedTitle: 'transit:transitScenario:Scenarios',
                iconWhite: '/dist/images/icons/transit/scenario_white.svg',
                iconBlack: '/dist/images/icons/transit/scenario_black.svg'
            },
            routing: {
                localizedTitle: 'main:Routing',
                iconWhite: '/dist/images/icons/interface/routing_white.svg',
                iconBlack: '/dist/images/icons/interface/routing_black.svg'
            },
            comparison: {
                localizedTitle: 'transit:transitComparison:ScenarioComparison',
                iconWhite: '/dist/images/icons/transit/comparison_white.svg',
                iconBlack: '/dist/images/icons/transit/comparison_black.svg'
            },
            accessibilityMap: {
                localizedTitle: 'main:AccessibilityMap',
                iconWhite: '/dist/images/icons/interface/accessibility_map_white.svg',
                iconBlack: '/dist/images/icons/interface/accessibility_map_black.svg'
            },
            accessibilityComparison: {
                localizedTitle: 'transit:accessibilityComparison:Title',
                iconWhite: '/dist/images/icons/interface/map_comparison_white.svg',
                iconBlack: '/dist/images/icons/interface/map_comparison_black.svg'
            },
            batchCalculation: {
                localizedTitle: 'main:BatchCalculation',
                iconWhite: '/dist/images/icons/interface/od_routing_white.svg',
                iconBlack: '/dist/images/icons/interface/od_routing_black.svg'
            },
            simulations: {
                localizedTitle: 'transit:simulation:Simulations',
                iconWhite: '/dist/images/icons/interface/simulation_white.svg',
                iconBlack: '/dist/images/icons/interface/simulation_black.svg',
                enabled: false
            },
            gtfsImport: {
                localizedTitle: 'transit:gtfs:Import',
                iconWhite: '/dist/images/icons/interface/import_white.svg',
                iconBlack: '/dist/images/icons/interface/import_black.svg'
            },
            gtfsExport: {
                localizedTitle: 'transit:gtfs:Export',
                iconWhite: '/dist/images/icons/interface/export_white.svg',
                iconBlack: '/dist/images/icons/interface/export_black.svg'
            },
            preferences: {
                localizedTitle: 'main:Preferences',
                iconWhite: '/dist/images/icons/interface/preferences_white.svg',
                iconBlack: '/dist/images/icons/interface/preferences_black.svg'
            }
        };

        expect(projectConfig.sections).toEqual(expect.objectContaining(defaultSections));
    });

    test('should retain previous configuration', () => {
        const previousConfig = {
            sections: {
                customSection: {
                    localizedTitle: 'custom:CustomSection',
                    iconWhite: '/dist/images/icons/custom/custom_icon_white.svg',
                    iconBlack: '/dist/images/icons/custom/custom_icon_black.svg'
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
                    iconWhite: '/dist/images/icons/transit/lines_white.svg',
                    iconBlack: '/dist/images/icons/transit/lines_black.svg'
                },
                nodes: {
                    localizedTitle: 'transit:transitNode:Nodes',
                    iconWhite: '/dist/images/icons/transit/node_white.svg',
                    iconBlack: '/dist/images/icons/transit/node_black.svg'
                },
                services: {
                    localizedTitle: 'transit:transitService:Services',
                    iconWhite: '/dist/images/icons/transit/service_white.svg',
                    iconBlack: '/dist/images/icons/transit/service_black.svg'
                },
                scenarios: {
                    localizedTitle: 'transit:transitScenario:Scenarios',
                    iconWhite: '/dist/images/icons/transit/scenario_white.svg',
                    iconBlack: '/dist/images/icons/transit/scenario_black.svg'
                },
                routing: {
                    localizedTitle: 'main:Routing',
                    iconWhite: '/dist/images/icons/interface/routing_white.svg',
                    iconBlack: '/dist/images/icons/interface/routing_black.svg'
                },
                comparison: {
                    localizedTitle: 'transit:transitComparison:ScenarioComparison',
                    iconWhite: '/dist/images/icons/transit/comparison_white.svg',
                    iconBlack: '/dist/images/icons/transit/comparison_black.svg'
                },
                accessibilityMap: {
                    localizedTitle: 'main:AccessibilityMap',
                    iconWhite: '/dist/images/icons/interface/accessibility_map_white.svg',
                    iconBlack: '/dist/images/icons/interface/accessibility_map_black.svg'
                },
                accessibilityComparison: {
                    localizedTitle: 'transit:accessibilityComparison:Title',
                    iconWhite: '/dist/images/icons/interface/map_comparison_white.svg',
                    iconBlack: '/dist/images/icons/interface/map_comparison_black.svg'
                },
                batchCalculation: {
                    localizedTitle: 'main:BatchCalculation',
                    iconWhite: '/dist/images/icons/interface/od_routing_white.svg',
                    iconBlack: '/dist/images/icons/interface/od_routing_black.svg'
                },
                simulations: {
                    localizedTitle: 'transit:simulation:Simulations',
                    iconWhite: '/dist/images/icons/interface/simulation_white.svg',
                    iconBlack: '/dist/images/icons/interface/simulation_black.svg',
                    enabled: false
                },
                gtfsImport: {
                    localizedTitle: 'transit:gtfs:Import',
                    iconWhite: '/dist/images/icons/interface/import_white.svg',
                    iconBlack: '/dist/images/icons/interface/import_black.svg'
                },
                gtfsExport: {
                    localizedTitle: 'transit:gtfs:Export',
                    iconWhite: '/dist/images/icons/interface/export_white.svg',
                    iconBlack: '/dist/images/icons/interface/export_black.svg'
                },
                preferences: {
                    localizedTitle: 'main:Preferences',
                    iconWhite: '/dist/images/icons/interface/preferences_white.svg',
                    iconBlack: '/dist/images/icons/interface/preferences_black.svg'
                }
            }
        };

        expect(projectConfig.sections).toEqual(expect.objectContaining(expectedConfig.sections));
    });
});
