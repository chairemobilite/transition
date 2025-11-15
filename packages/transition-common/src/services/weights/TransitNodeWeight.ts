/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { WeightDataSource } from './WeightDataSource';
import { Node } from '../nodes/Node';

/**
 * Attributes for a transit node weight, representing the calculated weight
 * for a specific node using a specific weight data source
 */
export interface TransitNodeWeightAttributes {
    weight_data_source_id: number;
    transit_node_id: string;
    weight_value: number;
}

/**
 * A transit node weight represents the calculated weight for a transit node
 * based on a specific weight data source and weighting model.
 * This is a join table entry linking weight data sources to transit nodes.
 */
export class TransitNodeWeight {
    protected static displayName = 'TransitNodeWeight';
    protected _attributes: TransitNodeWeightAttributes;
    protected _weightDataSource: WeightDataSource | undefined;
    protected _transitNode: Node | undefined;

    constructor(
        attributes: TransitNodeWeightAttributes,
        weightDataSource: WeightDataSource | undefined,
        transitNode: Node | undefined
    ) {
        this._attributes = attributes;
        this._weightDataSource = weightDataSource;
        this._transitNode = transitNode;
    }

    /** Get the transit node */
    get transitNode(): Readonly<Node> | undefined {
        return this._transitNode;
    }

    /** Get the weight data source */
    get weightDataSource(): Readonly<WeightDataSource> | undefined {
        return this._weightDataSource;
    }

    /** Get all attributes */
    get attributes(): Readonly<TransitNodeWeightAttributes> {
        return this._attributes;
    }

    /** Get the weight data source ID */
    get weightDataSourceId(): number {
        return this._attributes.weight_data_source_id;
    }

    /** Get the transit node ID (UUID) */
    get transitNodeId(): string {
        return this._attributes.transit_node_id;
    }

    /** Get the calculated weight value */
    get weightValue(): number {
        return this._attributes.weight_value;
    }

    toString(): string {
        return `Node ${this._attributes.transit_node_id}: weight ${this._attributes.weight_value}`;
    }

    static getDisplayName(): string {
        return TransitNodeWeight.displayName;
    }

    static getPluralName(): string {
        return 'transitNodeWeights';
    }

    static getCapitalizedPluralName(): string {
        return 'TransitNodeWeights';
    }
}

export default TransitNodeWeight;
