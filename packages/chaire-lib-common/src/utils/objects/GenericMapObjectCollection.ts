/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { MapObjectAttributes, MapObject } from './MapObject';
import GenericCollection from './GenericCollection';

export default abstract class GenericMapObjectCollection<
    M extends GeoJSON.GeometryObject,
    A extends MapObjectAttributes<M>,
    T extends MapObject<M, A>
> extends GenericCollection<GeoJSON.Feature<M, A>> {
    protected _idByIntegerId: Map<number, string> = new Map();

    constructor(features: GeoJSON.Feature<M, A>[], attributes?: { [key: string]: unknown }) {
        super(features, attributes);
        this._idByIntegerId = new Map();
        this.updateIndexes();
    }

    protected getFeatureId(feature: GeoJSON.Feature<M, A>): string {
        return feature.properties.id;
    }

    get length(): number {
        return this._features.length;
    }

    public setFeatures(features: GeoJSON.Feature<M, A>[]) {
        this._features = features;
        this.updateIndexes();
    }

    size(): number {
        return this._features.length;
    }

    updateIndexes(): void {
        super.updateIndexes();
        if (this._idByIntegerId) {
            this.updateIdByIntegerId();
        }
    }

    private isObject(feature: GeoJSON.Feature<M, A> | T): feature is T {
        return 'toGeojson' in feature;
    }

    public updateById(featureId: string, updatedFeature: GeoJSON.Feature<M, A> | T) {
        const geojsonFeature = this.isObject(updatedFeature)
            ? updatedFeature.toGeojson()
            : (updatedFeature as GeoJSON.Feature<M, A>);
        super.updateById(featureId, geojsonFeature);
    }

    public add(feature: GeoJSON.Feature<M, A> | T) {
        const geojsonFeature = this.isObject(feature) ? feature.toGeojson() : (feature as GeoJSON.Feature<M, A>);
        super.add(geojsonFeature);
    }

    public updateFeature(feature: GeoJSON.Feature<M, A> | T) {
        const geojsonFeature = this.isObject(feature) ? feature.toGeojson() : (feature as GeoJSON.Feature<M, A>);
        super.updateFeature(geojsonFeature);
    }

    updateIdByIntegerId() {
        this._idByIntegerId.clear();
        for (let i = 0, count = this.size(); i < count; i++) {
            const feature = this.features[i];
            if (feature.properties && feature.properties.id && feature.properties.integer_id) {
                this._idByIntegerId.set(feature.properties.integer_id, feature.properties.id);
            }
        }
    }

    getIdByIntegerId(featureIntegerId: number): string | undefined {
        return this._idByIntegerId.get(featureIntegerId);
    }

    toGeojson(): GeoJSON.FeatureCollection<M> {
        return {
            type: 'FeatureCollection',
            features: this.features
        };
    }

    // TODO Is this needed in the map collection? Leaving it commented in case it is
    /*forJson(parser?: ((object: any) => { [key: string]: any }) | null | undefined): { [key: string]: any } {
        const jsonArray: { [key: string]: any }[] = [];
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
    }*/

    // TODO: Type the attribs to be generic enough
    abstract newObject(feature: GeoJSON.Feature<M, A>, isNew?: boolean): T;
}
