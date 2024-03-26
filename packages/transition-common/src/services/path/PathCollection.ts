/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash/get';
import geobuf from 'geobuf';
import Pbf from 'pbf';

import { Path, PathAttributes } from './Path';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericMapObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericMapObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import TrError from 'chaire-lib-common/lib/utils/TrError';

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
}

export default PathCollection;
