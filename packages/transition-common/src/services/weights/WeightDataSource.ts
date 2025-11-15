/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { WeightingModel } from './WeightingModel';

/**
 * Attributes for a weight data source that contains weighted points
 */
export interface WeightDataSourceAttributes {
    id: number;
    name: string;
    description?: string;
    weighting_model_id?: number;
    max_access_time_seconds?: number; // default to 20 minutes
    max_bird_distance_meters?: number; // default to 15 min at 5 km/h, must be less than max_access_time which is network travel time, with detours.
    created_at?: string;
    updated_at?: string;
}

/**
 * A weight data source represents a collection of weighted points (e.g., POIs)
 * that will be used to calculate weights for transit nodes.
 */
export class WeightDataSource {
    protected static displayName = 'WeightDataSource';
    protected _weightingModel: WeightingModel | undefined;
    protected _attributes: WeightDataSourceAttributes;

    constructor(attributes: WeightDataSourceAttributes, weightingModel: WeightingModel | undefined) {
        this._attributes = attributes;
        this._weightingModel = weightingModel;
    }

    /** Returns the numeric id */
    get id(): number {
        return this._attributes.id;
    }

    /** Get all attributes */
    get attributes(): Readonly<WeightDataSourceAttributes> {
        return this._attributes;
    }

    /** Get the data source name */
    get name(): string {
        return this._attributes.name;
    }

    /** Get the description */
    get description(): string | undefined {
        return this._attributes.description;
    }

    /** Get the associated weighting model ID */
    get weightingModelId(): number | undefined {
        return this._attributes.weighting_model_id;
    }

    /** Get the associated weighting model */
    get weightingModel(): Readonly<WeightingModel> | undefined {
        return this._weightingModel;
    }

    /** Get the maximum access time in seconds */
    get maxAccessTimeSeconds(): number | undefined {
        return this._attributes.max_access_time_seconds;
    }

    /** Get the maximum bird distance in meters */
    get maxBirdDistanceMeters(): number | undefined {
        return this._attributes.max_bird_distance_meters;
    }

    /** Get the creation timestamp */
    get createdAt(): string | undefined {
        return this._attributes.created_at;
    }

    /** Get the last update timestamp */
    get updatedAt(): string | undefined {
        return this._attributes.updated_at;
    }

    toString(): string {
        return this._attributes.name;
    }

    static getDisplayName(): string {
        return WeightDataSource.displayName;
    }

    static getPluralName(): string {
        return 'weightDataSources';
    }

    static getCapitalizedPluralName(): string {
        return 'WeightDataSources';
    }
}

export default WeightDataSource;
