/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import CollectionCacheable from 'chaire-lib-common/lib/services/objects/CollectionCacheable';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import CollectionLoadable from 'chaire-lib-common/lib/services/objects/CollectionLoadable';
import GenericObjectCollection from 'chaire-lib-common/lib/utils/objects/GenericObjectCollection';
import Progressable from 'chaire-lib-common/lib/utils/objects/Progressable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { EventManager } from 'chaire-lib-common/lib/services/events/EventManager';

import Line from './Line';

/**
 * A collection of transit scenarios
 */
class LineCollection extends GenericObjectCollection<Line> implements Progressable {
    protected static displayName = 'LineCollection';
    protected static socketPrefix = 'transitLines';
    protected static instanceClass = Line;

    private _eventManager: EventManager | undefined;

    constructor(features, attributes, eventManager?: EventManager) {
        super(features, attributes);
        this._eventManager = eventManager;
    }

    progress(progressEventName: string, completeRatio: number): void {
        if (this._eventManager)
            this._eventManager.emitProgress(`${LineCollection.displayName}${progressEventName}`, completeRatio);
    }

    getByAgencyId(agencyId: string) {
        const features: Line[] = [];
        for (let i = 0, count = this.features.length; i < count; i++) {
            if (this.features[i].attributes.agency_id === agencyId) {
                features.push(this.features[i]);
            }
        }
        return features;
    }

    forCsv() {
        return this._features.map((line) => {
            return {
                uuid: line.attributes.id,
                shortname: line.attributes.shortname,
                longname: line.attributes.longname,
                mode: line.attributes.mode,
                category: line.attributes.category,
                agency_uuid: line.attributes.agency_id,
                internal_id: line.attributes.internal_id,
                color: line.attributes.color,
                is_autonomous: String(line.attributes.is_autonomous),
                allow_same_line_transfers: String(line.attributes.allow_same_line_transfers)
            };
        });
    }

    forJson() {
        return this.features.map((line) => {
            return line.attributes;
        });
    }

    deleteMultipleCache(socket, lineIds, customCachePath = null) {
        return new Promise((resolve, reject) => {
            socket.emit('transitLine.deleteMultipleCache', lineIds, customCachePath, (response) => {
                if (!response.error) {
                    resolve(response);
                } else {
                    reject(response.error);
                }
            });
        });
    }

    newObject(attribs: Partial<GenericAttributes>, isNew = false, collectionManager?: CollectionManager): Line {
        return new Line(attribs, isNew, collectionManager);
    }

    saveCache(socket, customCollection) {
        return CollectionCacheable.saveCache(this, socket, customCollection);
    }

    loadCache(socket) {
        return CollectionCacheable.loadCache(this, socket);
    }

    loadFromServer(socket, collectionManager?) {
        return CollectionLoadable.loadFromServer(this, socket, collectionManager);
    }

    loadFromCollection(collection, collectionManager?) {
        return CollectionLoadable.loadFromCollection(this, collection, collectionManager);
    }
}

export default LineCollection;
