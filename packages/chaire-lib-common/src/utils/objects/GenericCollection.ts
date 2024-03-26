/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericImmutableCollection from './GenericImmutableCollection';

/**
 * A collection of objects. This collection allows to get objects by various of
 * its attributes and also indexes the objects on common attributes.
 */
export default abstract class GenericCollection<F> extends GenericImmutableCollection<F> {
    constructor(features: F[], attributes?: { [key: string]: unknown }) {
        super(features, attributes);
    }

    public setFeatures(features: F[]) {
        this._features = features;
        this.updateIndexes();
    }

    public add(feature: F) {
        if (this.getFeatureId(feature) && !this.getById(this.getFeatureId(feature))) {
            this._features.push(feature);
            this.updateIndexesForFeature(feature, this.size() - 1);
        }
    }

    public getByShortenedId(shortenedId) {
        // (shortened uuid). Will return the first matching feature
        for (let i = 0, count = this._features.length; i < count; i++) {
            if (this.getFeatureId(this._features[i]).startsWith(shortenedId)) {
                return this._features[i];
            }
        }
        return null;
    }

    public updateById(featureId: string, updatedFeature: F) {
        if (this.getFeatureId(updatedFeature) !== featureId) {
            console.error('the id of the updatedFeature must match the featureId');
        } else {
            this.updateFeature(updatedFeature);
        }
    }

    public updateFeature(updatedFeature: F) {
        // TODO Should it not update the indexes? How do we know if one of the indexed field changed?
        const featureId = this.getFeatureId(updatedFeature);
        const featureIndex = this._indexById.get(featureId);
        if (featureIndex !== null && featureIndex !== undefined && featureIndex >= 0) {
            this._features[featureIndex] = updatedFeature;
        } else {
            console.error(`trying to update by id but we cannot find the feature (feature id: ${featureId})`);
        }
    }

    public removeById(featureId: string) {
        const featureIndex = this._indexById.get(featureId);
        if (featureIndex !== null && featureIndex !== undefined && featureIndex >= 0) {
            this._features.splice(featureIndex, 1);
            this.updateIndexes();
        } else {
            console.error(`trying to remove by id but we cannot find the feature (feature id: ${featureId})`);
        }
    }

    public removeByIds(featureIds: string[]) {
        let removedFeaturesCount = 0;
        const featureIndexesToRemove: number[] = [];
        // we first need to get all indexes, and splice later to keep indexById integrity:
        for (let i = 0, count = featureIds.length; i < count; i++) {
            const featureId = featureIds[i];
            const featureIndex = this._indexById.get(featureId);
            if (featureIndex !== null && featureIndex !== undefined && featureIndex >= 0) {
                featureIndexesToRemove.push(featureIndex);
            } else {
                console.error(`trying to remove by id but we cannot find the feature (feature id: ${featureId})`);
            }
        }
        // sort and loop indexes in reverse order so we keep next indexes unchanged:
        featureIndexesToRemove.sort();
        for (let i = featureIndexesToRemove.length - 1; i >= 0; i--) {
            this._features.splice(featureIndexesToRemove[i], 1);
            removedFeaturesCount++;
        }
        if (removedFeaturesCount > 0) {
            this.updateIndexes();
        }
    }

    public clear() {
        this.setFeatures([]);
    }
}
