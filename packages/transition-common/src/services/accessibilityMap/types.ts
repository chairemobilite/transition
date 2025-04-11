/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// TODO Move more types to this file

/**
 * Options for the calculation of the accessibility map
 */
export interface TransitMapCalculationOptions {
    isCancelled?: (() => boolean) | false;
    port?: number;
    /**
     * Additional properties to add to each accessibility polygon calculated
     *
     * @type {{ [key: string]: any }}
     * @memberof TransitMapCalculationOptions
     */
    additionalProperties?: { [key: string]: any };
    [key: string]: any;
}

/**
 * Options for the colors of the displayed map when calculating the map comparison.
 */
export interface TransitMapColorOptions {
    intersectionColor: string;
    scenario1Minus2Color: string;
    scenario2Minus1Color: string;
}
