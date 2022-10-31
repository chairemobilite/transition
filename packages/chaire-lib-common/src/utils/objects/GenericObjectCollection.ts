/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GenericCollection from './GenericCollection';
import { GenericObject, GenericAttributes } from './GenericObject';
import { _isBlank } from '../LodashExtensions';
import CollectionManager from './CollectionManager';

export default abstract class GenericObjectCollection<
    T extends GenericObject<GenericAttributes>
> extends GenericCollection<T> {
    protected _shouldIndexByInternalId = false; // TODO: should be replaced by a simple list of attributes to index
    protected _indexByInternalId: Map<string, number>;
    protected _shouldIndexByShortname = false;
    protected _indexByShortname: Map<string, number>;

    constructor(
        features: T[],
        attributes?: { [key: string]: unknown },
        // TODO needed ?
        shouldIndexByInternalId = false,
        shouldIndexByShortname = false
    ) {
        super(features, attributes);
        this._shouldIndexByInternalId = shouldIndexByInternalId;
        this._shouldIndexByShortname = shouldIndexByShortname;
        this._indexByInternalId = new Map();
        this._indexByShortname = new Map();
        this.updateIndexes();
    }

    protected getFeatureId(feature: T): string {
        return feature.getAttributes().id;
    }

    updateIndexes() {
        super.updateIndexes();
        if (this._shouldIndexByInternalId) {
            this.updateIndexByInternalId();
        }
        if (this._shouldIndexByShortname) {
            this.updateIndexByShortname();
        }
    }

    updateIndexesForFeature(feature: T, index: number): void {
        super.updateIndexesForFeature(feature, index);
        const internalId = feature.attributes.internal_id;
        if (this._shouldIndexByInternalId && typeof internalId === 'string' && internalId !== '') {
            this._indexByInternalId.set(internalId, index);
        }
        const shortname = feature.attributes.shortname;
        if (this._shouldIndexByShortname && typeof shortname === 'string' && shortname !== '') {
            this._indexByShortname.set(shortname, index);
        }
    }

    updateIndexByInternalId(): void {
        this._indexByInternalId.clear();
        for (let i = 0, count = this.size(); i < count; i++) {
            const feature = this._features[i];
            const internalId = feature.attributes.internal_id;
            if (typeof internalId === 'string' && internalId !== '') {
                this._indexByInternalId.set(internalId, i);
            } else {
                console.error(
                    `trying to index by internal_id but the feature does not have a valid internal_id string (feature id: ${feature.id})`
                );
            }
        }
    }

    updateIndexByShortname(): void {
        this._indexByShortname.clear();
        for (let i = 0, count = this.size(); i < count; i++) {
            const feature = this._features[i];
            const shortname = feature.attributes.shortname;
            if (typeof shortname === 'string' && shortname !== '') {
                this._indexByShortname.set(shortname, i);
            } else {
                console.error(
                    `trying to index by shortname but the feature does not have a valid shortname string (feature id: ${feature.id})`
                );
            }
        }
    }

    getByInternalId(featureInternalId: string): T | undefined {
        const featureIndex = this._indexByInternalId.get(featureInternalId);
        return featureIndex !== undefined && featureIndex >= 0 ? this._features[featureIndex] : undefined;
    }

    getByShortname(featureShortname: string): T | undefined {
        const featureIndex = this._indexByShortname.get(featureShortname);
        return featureIndex !== undefined && featureIndex >= 0 ? this._features[featureIndex] : undefined;
    }

    getIndexByInternalId(featureInternalId: string): number | undefined {
        if (!this._shouldIndexByInternalId) {
            console.error('index by internal id is not activated');
        }
        if (_isBlank(featureInternalId)) {
            console.error('feature internal id is blank');
        }
        return this._indexByInternalId.get(featureInternalId);
    }

    getIndexByShortname(featureShortname: string): number | undefined {
        if (!this._shouldIndexByShortname) {
            console.error('index by shortname is not activated');
        }
        if (_isBlank(featureShortname)) {
            console.error('feature shortname is blank');
        }
        return this._indexByShortname.get(featureShortname);
    }

    public getByAttribute(attribute: string, value: unknown) {
        // attribute can be a full attribute path: exmaple: data.foo.bar
        const features: T[] = [];
        for (let i = 0, count = this._features.length; i < count; i++) {
            if (this._features[i].get(attribute) === value) {
                features.push(this._features[i]);
            }
        }
        return features;
    }

    // TODO object is of the type of the generic object attributes. Can we type it correctly?
    // In fact features could be simple objects to, in that case, we just pass them through directly.
    forJson(parser?: ((object: GenericAttributes) => GenericAttributes) | null | undefined): GenericAttributes[] {
        const jsonArray: GenericAttributes[] = [];
        if (this._features) {
            for (let i = 0, count = this.size(); i < count; i++) {
                const feature = this._features[i];
                const attributes = feature.getAttributes();
                if (parser && typeof parser === 'function') {
                    jsonArray.push(parser(attributes));
                } else {
                    jsonArray.push(attributes);
                }
            }
        }
        return jsonArray;
    }

    abstract newObject(feature: Partial<GenericAttributes>, isNew?: boolean, collectionManager?: CollectionManager): T;
}
