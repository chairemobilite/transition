/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { SimulationAlgorithmDescriptor } from '../TransitNetworkDesignAlgorithm';

// Define accessibility map simulation options
export type AccessibilityMapSimulationOptions = {
    dataSourceId: string;
    sampleRatio: number;
};

/**
 * Descriptor class for the accessibility map simulation method options. It
 * documents the options, types, validation and default values. It also
 * validates the whole options object.
 *
 * The accessibility map simulation method simulates the network by calculating
 * the number of places accessible within certain parameters from various points
 * in the network.
 */
export class AccessibilityMapSimulationDescriptor
implements SimulationAlgorithmDescriptor<AccessibilityMapSimulationOptions> {
    getTranslatableName = (): string => 'transit:simulation:simulationMethods:AccessibilityMap';

    // TODO Add help texts
    getOptions = () => ({
        dataSourceId: {
            i18nName: 'transit:simulation:simulationMethods:AccessMapDataSources',
            type: 'select' as const,
            choices: async () => {
                // FIXME Still using data source queries. When this code was in the
                // backend, it used the query to fetch the data source, now let's just
                // use an empty array (this won't work, but it already doesn't work)
                const dataSources: { id: string; shortname: string }[] = [];
                return dataSources.map((ds) => ({
                    value: ds.id,
                    label: ds.shortname
                }));
            }
        },
        sampleRatio: {
            i18nName: 'transit:simulation:simulationMethods:AccessMapMaxSampleRatio',
            type: 'number' as const,
            validate: (value: number) => value > 0 && value <= 1,
            default: 1
        }
    });

    validateOptions = (_options: Partial<AccessibilityMapSimulationOptions>): { valid: boolean; errors: string[] } => {
        const valid = true;
        const errors: string[] = [];

        // TODO Actually validate something

        return { valid, errors };
    };
}
