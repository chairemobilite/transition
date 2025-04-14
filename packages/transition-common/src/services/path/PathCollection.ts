/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Path, PathAttributes } from './Path';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericMapObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericMapObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

/**
 * A collection of transit paths
 */
export class PathCollection
    extends GenericMapObjectCollection<GeoJSON.LineString, PathAttributes, Path>
    implements Progressable {
    protected static displayName = 'PathCollection';
    protected static socketPrefix = 'transitPaths';
    protected static instanceClass = Path;

    private _eventManager: EventManager | undefined;

    constructor(
        features: GeoJSON.Feature<GeoJSON.LineString, PathAttributes>[],
        attributes: { [key: string]: any },
        eventManager?: EventManager
    ) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${PathCollection.displayName}${progressEventName}`, completeRatio);
    }

    newObject(feature: GeoJSON.Feature<GeoJSON.LineString, PathAttributes>, isNew = false, collectionManager?): Path {
        return new Path(
            Object.assign({}, feature.properties, { geography: feature.geometry }),
            isNew,
            collectionManager
        );
    }

    saveCache(socket, customCollection?: any) {
        return CollectionCacheable.saveCache(this, socket, customCollection);
    }

    loadCache(socket) {
        return CollectionCacheable.loadCache(this, socket);
    }

    loadFromServer(socket) {
        return CollectionLoadable.loadGeojsonFromServer(this, socket);
    }

    loadFromCollection(collection) {
        return CollectionLoadable.loadGeojsonFromCollection(this, collection);
    }

    // TODO: Consider always having the simplified version of the path in the collection and load the full path only when necessary. There may be side-effects to doing this and there may be additional properties required in the main collection. Needs some thought.
    toGeojsonSimplified(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
        const features = this.features.map(({ id, geometry, properties, type }) => ({
            type,
            id,
            geometry,
            properties: {
                mode: properties.mode,
                color: properties.color,
                line_id: properties.line_id,
                id: properties.id
            }
        }));
        return {
            type: 'FeatureCollection',
            features
        };
    }
}

export default PathCollection;
