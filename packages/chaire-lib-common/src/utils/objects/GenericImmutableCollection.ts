/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validate as validateUuid } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import { GenericObject } from './GenericObject';
import { _isBlank } from '../LodashExtensions';

/**
 * An immutable collection of objects. This collection allows to get objects by
 * various of its attributes and also indexes the objects on common attributes.
 */
export default abstract class GenericImmutableCollection<F> {
    public _attributes: { [key: string]: unknown }; // TODO temporary public, there are still code that do not use getAttributes yet
    protected _features: F[];
    protected _indexById: Map<string, number>; // id is a uuid (string)

    constructor(features: F[], attributes?: { [key: string]: unknown }) {
        this._attributes = _cloneDeep(attributes) || {};
        this._features = features;
        this._indexById = new Map();
        this.updateIndexes();
    }

    get length(): number {
        return this._features.length;
    }

    // TODO: Replace all calls to this by getFeatures()
    get features(): F[] {
        return this._features;
    }

    get attributes(): { [key: string]: unknown } {
        return this._attributes;
    }

    size(): number {
        return this._features.length;
    }

    updateIndexes(): void {
        this.updateIndexById();
    }

    updateIndexesForFeature(feature: F, index: number): void {
        this._indexById.set(this.getFeatureId(feature), index);
    }

    updateIndexById(): void {
        this._indexById.clear();
        for (let i = 0, count = this.size(); i < count; i++) {
            const feature = this._features[i];
            const featureId = this.getFeatureId(feature);
            if (!_isBlank(featureId)) {
                this._indexById.set(featureId, i); // id should be uuid validated by GenericObject
            } else {
                console.error('trying to index by id but the feature does not have a valid uuid');
            }
        }
    }

    protected abstract getFeatureId(feature: F): string;

    getFeatures(): F[] {
        return this._features;
    }

    getIds(): string[] {
        return Array.from(this._indexById.keys());
    }

    getById(featureId: string): F | undefined {
        const featureIndex = this._indexById.get(featureId);
        return featureIndex !== undefined && featureIndex >= 0 ? this._features[featureIndex] : undefined;
    }

    getIndex(featureId: string): number | undefined {
        if (_isBlank(featureId)) {
            console.error('feature id is blank');
        }
        if (!validateUuid(featureId)) {
            console.error('feature id is not a valid uuid');
        }
        return this._indexById.get(featureId);
    }

    getIndexById(featureId: string): number | undefined {
        // alias of getIndex
        return this.getIndex(featureId);
    }

    /**
     * @deprecated Use the .attributes accessor instead.
     */
    getAttributes(): { [key: string]: unknown } {
        return this._attributes;
    }

    get socketPrefix(): string {
        return (<any>this.constructor).socketPrefix ? (<any>this.constructor).socketPrefix : this.constructor.name;
    }

    get displayName(): string {
        return (<any>this.constructor).displayName ? (<any>this.constructor).displayName : this.constructor.name;
    }

    get instanceClass() {
        return (<any>this.constructor).instanceClass ? (<any>this.constructor).instanceClass : GenericObject;
    }
}
