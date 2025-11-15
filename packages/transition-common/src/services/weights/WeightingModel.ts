/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Travel time and distance data for a weighted point relative to a transit node
 */
export interface TravelTimeData {
    /** Travel time in seconds for walking mode */
    travel_time_walking?: number;
    /** Travel time in seconds for cycling mode */
    travel_time_cycling?: number;
    /** Travel time in seconds for driving mode */
    travel_time_driving?: number;
    /** Bird distance (Euclidean distance) in meters */
    bird_distance?: number;
}

/**
 * Attributes for a weighting model that defines how node weights are calculated
 */
export interface WeightingModelAttributes {
    id: number;
    name: string;
    /** The calculation choice value (should match one of CALCULATION_CHOICES) */
    calculation?: string;
    notes?: string;
    references?: string;
}

/**
 * Available calculation formulas for weighting models
 */
export interface CalculationChoice {
    /** The calculation identifier/code */
    value: string;
    /** The calculation formula function */
    formula: (weight: number, travelData: TravelTimeData) => number | undefined;
}

/**
 * Hardcoded list of available calculation choices for weighting models
 */
export const CALCULATION_CHOICES: CalculationChoice[] = [
    {
        value: 'weight_only',
        formula: (weight: number) => weight
    },
    {
        value: 'gravity_walking_1',
        formula: (weight: number, travelData: TravelTimeData) => {
            if (
                travelData.travel_time_walking === undefined ||
                !Number.isFinite(travelData.travel_time_walking) ||
                travelData.travel_time_walking <= 0
            ) {
                return undefined;
            }
            return weight / travelData.travel_time_walking;
        }
    },
    {
        value: 'gravity_walking_2',
        formula: (weight: number, travelData: TravelTimeData) => {
            if (
                travelData.travel_time_walking === undefined ||
                !Number.isFinite(travelData.travel_time_walking) ||
                travelData.travel_time_walking <= 0
            ) {
                return undefined;
            }
            return weight / (travelData.travel_time_walking * travelData.travel_time_walking);
        }
    },
    {
        value: 'gravity_cycling_1',
        formula: (weight: number, travelData: TravelTimeData) => {
            if (
                travelData.travel_time_cycling === undefined ||
                !Number.isFinite(travelData.travel_time_cycling) ||
                travelData.travel_time_cycling <= 0
            ) {
                return undefined;
            }
            return weight / travelData.travel_time_cycling;
        }
    },
    {
        value: 'gravity_cycling_2',
        formula: (weight: number, travelData: TravelTimeData) => {
            if (
                travelData.travel_time_cycling === undefined ||
                !Number.isFinite(travelData.travel_time_cycling) ||
                travelData.travel_time_cycling <= 0
            ) {
                return undefined;
            }
            return weight / (travelData.travel_time_cycling * travelData.travel_time_cycling);
        }
    },
    {
        value: 'gravity_driving_1',
        formula: (weight: number, travelData: TravelTimeData) => {
            if (
                travelData.travel_time_driving === undefined ||
                !Number.isFinite(travelData.travel_time_driving) ||
                travelData.travel_time_driving <= 0
            ) {
                return undefined;
            }
            return weight / travelData.travel_time_driving;
        }
    },
    {
        value: 'gravity_driving_2',
        formula: (weight: number, travelData: TravelTimeData) => {
            if (
                travelData.travel_time_driving === undefined ||
                !Number.isFinite(travelData.travel_time_driving) ||
                travelData.travel_time_driving <= 0
            ) {
                return undefined;
            }
            return weight / (travelData.travel_time_driving * travelData.travel_time_driving);
        }
    },
    {
        value: 'gravity_distance',
        formula: (weight: number, travelData: TravelTimeData) => {
            if (
                travelData.bird_distance === undefined ||
                !Number.isFinite(travelData.bird_distance) ||
                travelData.bird_distance <= 0
            ) {
                return undefined;
            }
            return weight / travelData.bird_distance;
        }
    },
    {
        value: 'gravity_distance_squared',
        formula: (weight: number, travelData: TravelTimeData) => {
            if (
                travelData.bird_distance === undefined ||
                !Number.isFinite(travelData.bird_distance) ||
                travelData.bird_distance <= 0
            ) {
                return undefined;
            }
            return weight / (travelData.bird_distance * travelData.bird_distance);
        }
    }
];

/**
 * Get a calculation choice by its value
 * @returns { CalculationChoice | undefined } The calculation choice
 */
export function getCalculationChoiceByValue(value: string): CalculationChoice | undefined {
    return CALCULATION_CHOICES.find((choice) => choice.value === value);
}

/**
 * A weighting model defines the calculation method used to compute node weights
 * from weighted points (POIs or OD destinations for instance) using a gravitational model.
 */
export class WeightingModel {
    protected static displayName = 'WeightingModel';
    protected _attributes: WeightingModelAttributes;

    constructor(attributes: WeightingModelAttributes) {
        this._attributes = attributes;
    }

    /** Returns the numeric id */
    get id(): number {
        return this._attributes.id;
    }

    /** Get all attributes */
    get attributes(): Readonly<WeightingModelAttributes> {
        return this._attributes;
    }

    /** Get the model name */
    get name(): string {
        return this._attributes.name;
    }

    /** Get the calculation method description */
    get calculation(): string | undefined {
        return this._attributes.calculation;
    }

    /** Get the notes */
    get notes(): string | undefined {
        return this._attributes.notes;
    }

    /** Get the references */
    get references(): string | undefined {
        return this._attributes.references;
    }

    /**
     * Get the calculation choice object based on the calculation value stored in attributes
     * @returns {CalculationChoice | undefined} the calculation choice
     */
    getCalculationChoice(): CalculationChoice | undefined {
        if (!this._attributes.calculation) {
            return undefined;
        }
        return getCalculationChoiceByValue(this._attributes.calculation);
    }

    /**
     * Calculate the node weight contribution for a given point using the model's calculation formula
     * @param weight The weight value of the point
     * @param travelData Travel times and distance data from the point to the node
     * @returns {number | undefined} The calculated weight contribution (or undefined if calculation choice not found or required data missing)
     */
    calculateWeight(weight: number, travelData: TravelTimeData): number | undefined {
        const choice = this.getCalculationChoice();
        if (!choice) {
            return undefined;
        }
        return choice.formula(weight, travelData);
    }

    toString(): string {
        return this._attributes.name;
    }

    static getDisplayName(): string {
        return WeightingModel.displayName;
    }

    static getPluralName(): string {
        return 'weightingModels';
    }

    static getCapitalizedPluralName(): string {
        return 'WeightingModels';
    }
}

export default WeightingModel;
