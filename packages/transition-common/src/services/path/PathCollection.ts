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

    async loadForScenario(socket, scenarioId: string) {
        return new Promise((resolve, reject) => {
            this.progress('LoadingFromServer', 0.0);
            const socketPrefix = this.socketPrefix;

            socket.emit(`${socketPrefix}.geojsonCollection`, { scenarioId, format: 'geobuf' }, (geojsonResponse) => {
                if ((geojsonResponse && geojsonResponse.geojson) || geojsonResponse.geobuf) {
                    //console.log(`parsing ${geojsonResponse.geobuf ? 'geobuf' : 'geojson'}`);
                    const geojson = geojsonResponse.geobuf
                        ? geobuf.decode(new Pbf(geojsonResponse.geobuf))
                        : geojsonResponse.geojson;
                    if (geojson && geojson.features && this.loadFromCollection(geojson.features).status === 'success') {
                        this.progress('LoadingFromServer', 1.0);
                        resolve(geojson);
                    }
                }
                this.progress('LoadingFromServer', 1.0);
                reject(
                    new TrError(
                        `cannot load ${socketPrefix} geojson collection from server`,
                        'CLG0003',
                        `${socketPrefix}GeojsonCollectionCouldNotBeFetchedFromServerBecauseServerError`
                    ).export()
                );
            });
        });
    }

    loadFromCollection(collection) {
        return CollectionLoadable.loadGeojsonFromCollection(this, collection);
    }
}

export default PathCollection;
