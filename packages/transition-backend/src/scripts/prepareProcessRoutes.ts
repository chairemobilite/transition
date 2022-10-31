/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import EventEmitter from 'events';

import allSocketRoutes from '../api/all.socketRoutes';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import EventManager from 'chaire-lib-common/lib/services/events/EventManager';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';

// Prepare a node process that is not the main server with the proper socket routes and events.
export default function() {
    serviceLocator.addService('socketEventManager', new EventManager(new EventEmitter()));
    // TODO We shouldn't need to have those. Classes called by the tasks should not use those, but they do
    serviceLocator.addService('eventManager', new EventManager(new EventEmitter()));
    serviceLocator.addService('collectionManager', new CollectionManager(serviceLocator.eventManager));

    allSocketRoutes(serviceLocator.socketEventManager);
    console.log('loaded socket routes');
}
