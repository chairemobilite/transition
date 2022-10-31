/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import DataSource from './DataSource';
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

/**
 * A collection of data sources
 */
class DataSourceCollection extends GenericObjectCollection<DataSource> implements Progressable {
    protected static displayName = 'DataSourceCollection';
    protected static socketPrefix = 'dataSources';
    protected static instanceClass = DataSource;

    private _eventManager: EventManager | undefined;

    constructor(features: DataSource[], attributes: { [key: string]: unknown }, eventManager?: EventManager) {
        super(features, attributes, false, true);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${DataSourceCollection.displayName}${progressEventName}`, completeRatio);
    }

    newObject(attribs: Partial<GenericAttributes>, isNew = false, collectionManager?: CollectionManager): DataSource {
        return new DataSource(attribs, isNew, collectionManager);
    }

    saveCache(socket, customCollection) {
        return CollectionCacheable.saveCache(this, socket, customCollection);
    }

    loadCache(socket) {
        return CollectionCacheable.loadCache(this, socket);
    }

    loadFromServer(socket, collectionManager?: CollectionManager) {
        return CollectionLoadable.loadFromServer(this, socket, collectionManager);
    }

    loadFromCollection(collection, collectionManager?: CollectionManager) {
        return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
    }
}

export default DataSourceCollection;
